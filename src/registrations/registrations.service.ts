import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { randomBytes } from 'crypto'

@Injectable()
export class RegistrationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Submit pendaftaran (dari landing page — public endpoint) ──────────────
  async submit(data: {
    fullName: string
    phone: string
    email?: string
    address: string
    district?: string
    city?: string
    packageId: string
    notes?: string
    latitude?: number
    longitude?: number
  }) {
    // SECURITY FIX: Validasi koordinat jika disertakan
    if (data.latitude !== undefined || data.longitude !== undefined) {
      if (
        typeof data.latitude !== 'number' ||
        typeof data.longitude !== 'number' ||
        data.latitude < -90 ||
        data.latitude > 90 ||
        data.longitude < -180 ||
        data.longitude > 180
      ) {
        throw new BadRequestException('Koordinat lokasi tidak valid')
      }
    }

    // SECURITY FIX: Batasi panjang notes agar tidak bisa dipakai untuk injection
    if (data.notes && data.notes.length > 500) {
      throw new BadRequestException('Catatan maksimal 500 karakter')
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: data.packageId },
    })
    if (!pkg) throw new BadRequestException('Paket tidak ditemukan')

    // Cek nomor HP sudah pernah daftar
    const existing = await this.prisma.registration.findFirst({
      where: { phone: data.phone, status: { in: ['PENDING', 'APPROVED'] } },
    })
    if (existing) {
      throw new BadRequestException('Nomor HP sudah pernah mendaftar')
    }

    // Cek nomor HP sudah jadi pelanggan aktif
    const activeUser = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    })
    if (activeUser) {
      throw new BadRequestException('Nomor HP sudah terdaftar sebagai pelanggan')
    }

    const registration = await this.prisma.registration.create({
      data: { ...data, status: 'PENDING' },
      include: { approvedBy: true },
    })

    return {
      message: 'Pendaftaran berhasil! Admin akan menghubungi kamu segera.',
      registration,
    }
  }

  // ── Get all registrations (admin) ─────────────────────────────────────────
  async findAll(query: {
    status?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const { status, search, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    // SECURITY FIX: Batasi limit maksimum
    const safeLimit = Math.min(limit, 100)

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          approvedBy: {
            select: { fullName: true, email: true },
          },
        },
      }),
      this.prisma.registration.count({ where }),
    ])

    return {
      data,
      meta: { total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
    }
  }

  // ── Get one registration ──────────────────────────────────────────────────
  async findOne(id: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        approvedBy: { select: { fullName: true, email: true } },
        user: { select: { id: true, customerCode: true, status: true } },
      },
    })
    if (!reg) throw new NotFoundException('Pendaftaran tidak ditemukan')
    return reg
  }

  // ── Approve pendaftaran ───────────────────────────────────────────────────
  async approve(id: string, adminId: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { id },
      include: { user: true },
    })
    if (!reg) throw new NotFoundException('Pendaftaran tidak ditemukan')
    if (reg.status !== 'PENDING') {
      throw new BadRequestException('Pendaftaran sudah diproses sebelumnya')
    }

    const count = await this.prisma.user.count()
    const customerCode = `WIFI-${String(count + 1).padStart(5, '0')}`

    // SECURITY FIX: Gunakan randomBytes(32) — sudah benar; panjang 64 hex chars
    const activationToken = randomBytes(32).toString('hex')
    const activationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 hari

    const user = await this.prisma.user.create({
      data: {
        fullName: reg.fullName,
        phone: reg.phone,
        email: reg.email,
        address: reg.address,
        district: reg.district,
        city: reg.city,
        customerCode,
        status: 'PENDING',
        activationToken,
        activationExpiry,
        packageId: reg.packageId,
        registrationId: reg.id,
      },
    })

    await this.prisma.registration.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: adminId,
        approvedAt: new Date(),
      },
    })

    if (reg.email) {
      // SECURITY FIX: Validasi FRONTEND_URL ada sebelum membentuk link
      const frontendUrl = process.env.FRONTEND_URL
      if (!frontendUrl) {
        throw new Error('FRONTEND_URL environment variable is not set')
      }
      const activationLink = `${frontendUrl}/activate?token=${activationToken}`
      await this.notifications.sendActivationEmail(reg.email, reg.fullName, activationLink)
    }

    return {
      message: 'Pendaftaran diapprove, link aktivasi dikirim ke pelanggan',
      user: { id: user.id, customerCode: user.customerCode },
    }
  }

  // ── Reject pendaftaran ────────────────────────────────────────────────────
  async reject(id: string, adminId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Alasan penolakan wajib diisi')
    }

    const reg = await this.prisma.registration.findUnique({ where: { id } })
    if (!reg) throw new NotFoundException('Pendaftaran tidak ditemukan')
    if (reg.status !== 'PENDING') {
      throw new BadRequestException('Pendaftaran sudah diproses sebelumnya')
    }

    await this.prisma.registration.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: adminId,
        approvedAt: new Date(),
        rejectedReason: reason.trim(),
      },
    })

    return { message: 'Pendaftaran ditolak' }
  }

  // ── Stats untuk dashboard admin ───────────────────────────────────────────
  async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.registration.count(),
      this.prisma.registration.count({ where: { status: 'PENDING' } }),
      this.prisma.registration.count({ where: { status: 'APPROVED' } }),
      this.prisma.registration.count({ where: { status: 'REJECTED' } }),
    ])
    return { total, pending, approved, rejected }
  }
}
