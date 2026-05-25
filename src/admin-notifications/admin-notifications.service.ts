import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AdminNotificationCategory, UserStatus } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service'

export interface AdminNotificationItem {
  id: string
  title: string
  message: string
  category: AdminNotificationCategory
  link: string | null
  isUrgent: boolean
  isRead: boolean
  metadata: any
  createdAt: Date
}

export interface GetAllParams {
  category?: AdminNotificationCategory
  isRead?: boolean
  page?: number
  limit?: number
}

export type PermintaanDecision = 'APPROVED' | 'REJECTED'

@Injectable()
export class AdminNotificationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private isUserRequestNotification(title: string): boolean {
    return (
      title.includes('Ganti Paket') ||
      title.includes('Pindah Alamat') ||
      title.includes('Putus Berlangganan')
    )
  }

  async create(data: {
    title: string
    message: string
    category: AdminNotificationCategory
    link?: string
    isUrgent?: boolean
    metadata?: Record<string, any>
  }): Promise<AdminNotificationItem> {
    return this.prisma.adminNotification.create({
      data: {
        title: data.title,
        message: data.message,
        category: data.category,
        link: data.link,
        isUrgent: data.isUrgent ?? false,
        metadata: data.metadata,
      },
    })
  }

  async getAll(params: GetAllParams = {}): Promise<{
    notifications: AdminNotificationItem[]
    meta: {
      total: number
      page: number
      limit: number
      totalPages: number
      unreadCount: number
    }
  }> {
    const { category, isRead, page = 1, limit = 20 } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (category) where.category = category
    if (isRead !== undefined) where.isRead = isRead

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({ where: { isRead: false } }),
    ])

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    }
  }

  async getByCategory(
    category: AdminNotificationCategory,
    page = 1,
    limit = 20,
  ): Promise<{
    notifications: AdminNotificationItem[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    return this.getAll({ category, page, limit })
  }

  async getUnread(page = 1, limit = 20): Promise<{
    notifications: AdminNotificationItem[]
    meta: { total: number; page: number; limit: number; totalPages: number; unreadCount: number }
  }> {
    return this.getAll({ isRead: false, page, limit })
  }

  /**
   * Proses permintaan pelanggan (ganti paket / pindah alamat / putus langganan)
   */
  async processUserRequest(
    id: string,
    decision: PermintaanDecision,
    note?: string,
  ): Promise<{ message: string; notification: AdminNotificationItem }> {
    const notif = await this.prisma.adminNotification.findUnique({ where: { id } })
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan')

    if (!this.isUserRequestNotification(notif.title)) {
      throw new BadRequestException('Notifikasi ini bukan permintaan pelanggan')
    }

    const metadata = (notif.metadata as Record<string, unknown> | null) ?? {}
    if (metadata.decision) {
      throw new BadRequestException('Permintaan sudah diproses sebelumnya')
    }

    const userId = metadata.userId as string | undefined
    if (!userId) throw new BadRequestException('Metadata userId tidak ditemukan')

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('Pelanggan tidak ditemukan')

    // 1. UPDATE DATA USER (Jika APPROVED)
    if (decision === 'APPROVED') {
      if (notif.title.includes('Ganti Paket')) {
        const newPackageId = metadata.newPackageId as string | undefined
        if (!newPackageId) throw new BadRequestException('ID paket baru tidak ditemukan')
        const pkg = await this.prisma.package.findUnique({ where: { id: newPackageId } })
        if (!pkg) throw new NotFoundException('Paket tidak ditemukan')
        await this.prisma.user.update({
          where: { id: userId },
          data: { packageId: newPackageId },
        })
      } else if (notif.title.includes('Pindah Alamat')) {
        const newAddress = metadata.newAddress as string | undefined
        if (!newAddress?.trim()) throw new BadRequestException('Alamat baru tidak ditemukan')
        await this.prisma.user.update({
          where: { id: userId },
          data: { address: newAddress.trim() },
        })
      } else if (notif.title.includes('Putus Berlangganan')) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { status: 'SUSPENDED' satisfies UserStatus },
        })
      }
    }

    // 2. 👇 TAMBAHAN BARU: UPDATE TABEL ServiceRequest BIAR GEMBOK USER KESINKRON! 👇
    const requestId = metadata.requestId as string | undefined;
    if (requestId) {
      await this.prisma.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          adminNotes: note?.trim(),
          processedAt: new Date(),
        }
      }).catch(err => {
        // Ignored gracefully if somehow ID not found, but normally it should exist
        console.error('Gagal update ServiceRequest:', err);
      });
    }
    // 👆 AKHIR TAMBAHAN BARU 👆

    // 3. UPDATE TABEL AdminNotification
    const updated = await this.prisma.adminNotification.update({
      where: { id },
      data: {
        isRead: true,
        metadata: {
          ...metadata,
          decision,
          processedAt: new Date().toISOString(),
          ...(decision === 'REJECTED' && note?.trim() ? { rejectNote: note.trim() } : {}),
        },
      },
    })

    // 4. KIRIM NOTIFIKASI KE USER
    if (decision === 'APPROVED') {
      await this.notifications.createNotification({
        userId,
        type: 'ACCOUNT_ACTIVATED' as any,
        title: 'Permintaan Disetujui ✅',
        message: `Permintaan Anda "${notif.title.replace(/^[^\w]+/, '').trim()}" telah disetujui admin.`,
      })
    } else {
      await this.notifications.createNotification({
        userId,
        type: 'ACCOUNT_SUSPENDED' as any,
        title: 'Permintaan Ditolak ❌',
        message: note?.trim()
          ? `Permintaan Anda ditolak. Alasan: ${note.trim()}`
          : 'Permintaan Anda ditolak oleh admin. Silakan hubungi customer service jika perlu bantuan.',
      })
    }

    return {
      message: decision === 'APPROVED' ? 'Permintaan disetujui' : 'Permintaan ditolak',
      notification: updated,
    }
  }

  async markAsRead(id: string): Promise<AdminNotificationItem> {
    return this.prisma.adminNotification.update({
      where: { id },
      data: { isRead: true },
    })
  }

  async markManyAsRead(ids: string[]): Promise<{ count: number }> {
    return this.prisma.adminNotification.updateMany({
      where: { id: { in: ids } },
      data: { isRead: true },
    })
  }

  async markAllAsRead(): Promise<{ count: number }> {
    return this.prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.adminNotification.delete({
      where: { id },
    })
  }

  async deleteMany(ids: string[]): Promise<{ count: number }> {
    return this.prisma.adminNotification.deleteMany({
      where: { id: { in: ids } },
    })
  }

  async getSummary(): Promise<{
    totalUnread: number
    byCategory: Record<AdminNotificationCategory, number>
    urgentUnread: number
  }> {
    const [unreadCount, urgentCount] = await Promise.all([
      this.prisma.adminNotification.count({ where: { isRead: false } }),
      this.prisma.adminNotification.count({
        where: { isRead: false, isUrgent: true },
      }),
    ])

    const categories = ['FINANCE', 'SUPPORT', 'SYSTEM', 'ACCOUNT', 'BILLING'] as const
    const byCategoryPromises = categories.map((cat) =>
      this.prisma.adminNotification.count({
        where: { category: cat, isRead: false },
      }),
    )

    const byCategoryCounts = await Promise.all(byCategoryPromises)
    const byCategory = Object.fromEntries(
      categories.map((cat, idx) => [cat, byCategoryCounts[idx]]),
    ) as Record<AdminNotificationCategory, number>

    return {
      totalUnread: unreadCount,
      byCategory,
      urgentUnread: urgentCount,
    }
  }

  async deleteOlderThan(days: number): Promise<{ count: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return this.prisma.adminNotification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    })
  }
}