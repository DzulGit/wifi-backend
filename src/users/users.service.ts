import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UserStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { NotificationsService } from '../notifications/notifications.service'
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service'
import { AdminNotificationHelper } from '../admin-notifications/admin-notification.helper'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private adminNotifications: AdminNotificationsService,
  ) {}

  // ─── FITUR REQUEST USER ──────────────────────────────────────────

  async requestPackageChange(userId: string, newPackageId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const newPkg = await this.prisma.package.findUnique({ where: { id: newPackageId } });

    if (!user || !newPkg) throw new NotFoundException('Data user atau paket tidak ditemukan');

    await this.adminNotifications.create({
      title: '🔄 Request Ganti Paket',
      message: `Pelanggan ${user.fullName} (${user.customerCode}) mengajukan pindah ke paket ${newPkg.name}.`,
      category: 'SYSTEM',
      link: '/admin/permintaan?tab=ganti_paket',
      isUrgent: false,
      metadata: { userId, newPackageId, requestType: 'PACKAGE' }
    });

    return { message: 'Request ganti paket berhasil dikirim ke admin' };
  }

  async requestCancellation(userId: string, reason: string) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User tidak ditemukan');

  await this.adminNotifications.create({
    title: 'Pengajuan Putus Berlangganan', // ← SEBELUMNYA: 'Request Putus Berlangganan' 
    message: `Pelanggan ${user.fullName} (${user.customerCode}) mengajukan putus berlangganan. Alasan: ${reason}`,
    category: 'SYSTEM',
    link: '/admin/permintaan?tab=putus_langganan',
    isUrgent: true,
    metadata: { userId, reason, requestType: 'CANCEL' }
  });

  return { message: 'Request putus berlangganan berhasil dikirim' };
}

  async requestAddressMove(userId: string, newAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    await this.adminNotifications.create({
      title: '🏠 Request Pindah Alamat',
      message: `Pelanggan ${user.fullName} (${user.customerCode}) mengajukan pindah alamat ke: ${newAddress}`,
      category: 'SYSTEM',
      link: '/admin/permintaan?tab=pindah_alamat',
      isUrgent: false,
      metadata: { userId, newAddress, requestType: 'ADDRESS' }
    });

    return { message: 'Request pindah alamat berhasil dikirim' };
  }

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

    // Cek duplikat email
    if (data.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: data.email },
      })
      if (existingEmail) {
        throw new BadRequestException('Email sudah terdaftar, silakan gunakan email lain');
      }
    }

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
    profilePhoto?: string
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

    // 👇 3. NOTIFIKASI STATUS AKUN DITANAM DI SINI 👇
    if (status === 'ACTIVE') {
      await this.notifications.createNotification({
        userId: id,
        type: 'ACCOUNT_ACTIVATED' as any,
        title: 'Akun Diaktifkan ✅',
        message: 'Selamat! Akun internet kamu sudah aktif dan bisa digunakan kembali.',
      });

      // 👇 ADMIN NOTIFICATION 👇
      await AdminNotificationHelper.accountActivated(this.adminNotifications, {
        userName: updated.fullName,
        customerCode: updated.customerCode,
        userId: updated.id,
      });
      // 👆 SELESAI 👆
    } else if (status === 'SUSPENDED') {
      await this.notifications.createNotification({
        userId: id,
        type: 'ACCOUNT_SUSPENDED' as any,
        title: 'Layanan Terisolir ⚠️',
        message: 'Mohon maaf, layanan internet kamu saat ini ditangguhkan sementara. Silakan lunasi tagihan atau hubungi admin.',
      });

      // 👇 ADMIN NOTIFICATION 👇
      await AdminNotificationHelper.accountSuspended(this.adminNotifications, {
        userName: updated.fullName,
        customerCode: updated.customerCode,
        reason: 'Overdue invoice or manual suspension',
        userId: updated.id,
      });
      // 👆 SELESAI 👆
    }
    // 👆 SELESAI 👆

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

  // Logika bisnis untuk mengubah status mantan pelanggan menjadi PENDING kembali dengan paket baru
  async resubscribe(userId: string, packageId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Data pelanggan tidak ditemukan');
    }

    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) {
      throw new NotFoundException('Paket internet yang dipilih tidak valid');
    }

    // Update status user menjadi PENDING dan perbarui paket pilihannya
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'PENDING',
        packageId: packageId,
      },
    });

    // Kirim notifikasi ke dashboard admin agar segera di-approve aktivasi ulangnya
    await this.adminNotifications.create({
      title: '✨ Pelanggan Berlangganan Kembali',
      message: `Mantan pelanggan ${user.fullName} (${user.customerCode}) mengajukan permohonan berlangganan kembali dengan memilih paket ${pkg.name}.`,
      category: 'ACCOUNT',
      link: '/admin/pelanggan',
      isUrgent: true,
      metadata: {
        userId: user.id,
        packageId: packageId,
        actionType: 'RESUBSCRIBE',
      },
    });

    return {
      message: 'Permohonan berlangganan kembali berhasil dikirim. Menunggu aktivasi dari Admin.',
      user: this.excludeSensitive(updatedUser),
    };
  }
}