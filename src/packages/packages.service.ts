import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  // ── Get all packages ──────────────────────────────────────
  async findAll(onlyActive = false) {
    return this.prisma.package.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { users: true } }, // berapa user pakai paket ini
      },
    })
  }

  // ── Get one package ───────────────────────────────────────
  async findOne(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    })
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan')
    return pkg
  }

  // ── Create package ────────────────────────────────────────
  async create(data: {
    name: string
    description?: string
    price: number
    speedDown: number
    speedUp: number
    quota?: number
    isUnlimited?: boolean
    features?: string[]
    color?: string
    isPopular?: boolean
    sortOrder?: number
  }) {
    // Auto generate slug dari name
    const slug = data.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    const existing = await this.prisma.package.findUnique({ where: { slug } })
    if (existing) throw new BadRequestException('Nama paket sudah ada')

    return this.prisma.package.create({
      data: { ...data, slug },
    })
  }

  // ── Update package ────────────────────────────────────────
  async update(id: string, data: {
    name?: string
    description?: string
    price?: number
    speedDown?: number
    speedUp?: number
    features?: string[]
    color?: string
    isPopular?: boolean
    isActive?: boolean
    sortOrder?: number
  }) {
    const pkg = await this.prisma.package.findUnique({ where: { id } })
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan')

    return this.prisma.package.update({
      where: { id },
      data,
    })
  }

  // ── Delete package ────────────────────────────────────────
  async remove(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan')

    // Tidak boleh hapus paket yang masih ada usernya
    if (pkg._count.users > 0) {
      throw new BadRequestException(
        `Paket tidak bisa dihapus, masih ada ${pkg._count.users} pelanggan`
      )
    }

    await this.prisma.package.delete({ where: { id } })
    return { message: 'Paket berhasil dihapus' }
  }
}