import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UserStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ── Generate customer code ────────────────────────────────
  private async generateCustomerCode(): Promise<string> {
    const count = await this.prisma.user.count()
    return `WIFI-${String(count + 1).padStart(5, '0')}`
  }

  // ── Get all users ─────────────────────────────────────────
  async findAll(query: {
    status?: UserStatus
    search?: string
    page?: number
    limit?: number
  }) {
    const { status, search, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { customerCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { package: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      data: users.map(u => this.excludeSensitive(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  // ── Get one user ──────────────────────────────────────────
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        package: true,
        invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
        tickets: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
    if (!user) throw new NotFoundException('User tidak ditemukan')
    return this.excludeSensitive(user)
  }

  // ── Create user (oleh admin) ──────────────────────────────
  async create(data: {
    fullName: string
    phone: string
    email?: string
    address: string
    district?: string
    city?: string
    province?: string
    packageId?: string
    notes?: string
  }) {
    // Cek duplikat phone
    const existing = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    })
    if (existing) throw new BadRequestException('Nomor HP sudah terdaftar')

    const customerCode = await this.generateCustomerCode()
    const activationToken = randomBytes(32).toString('hex')
    const activationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 hari

    const user = await this.prisma.user.create({
      data: {
        ...data,
        customerCode,
        status: 'PENDING',
        activationToken,
        activationExpiry,
      },
    })

    return {
      user: this.excludeSensitive(user),
      activationToken, // dikirim via email/WA ke user
    }
  }

  // ── Update user ───────────────────────────────────────────
  async update(id: string, data: {
    fullName?: string
    phone?: string
    email?: string
    address?: string
    district?: string
    city?: string
    province?: string
    packageId?: string
    notes?: string
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User tidak ditemukan')

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: { package: true },
    })
    return this.excludeSensitive(updated)
  }

  // ── Suspend / aktifkan user ───────────────────────────────
  async updateStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User tidak ditemukan')

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
    })
    return {
      message: `User berhasil di-${status.toLowerCase()}`,
      user: this.excludeSensitive(updated),
    }
  }

  // ── Get user stats (untuk dashboard admin) ───────────────
  async getStats() {
    const [total, active, suspended, pending, inactive] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { status: 'INACTIVE' } }),
    ])
    return { total, active, suspended, pending, inactive }
  }

  // ── Helper: hide sensitive fields ────────────────────────
  private excludeSensitive(user: any) {
    const { password, activationToken, activationExpiry, ...safe } = user
    return safe
  }
}