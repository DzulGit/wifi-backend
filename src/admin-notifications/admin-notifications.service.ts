import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AdminNotificationCategory } from '@prisma/client'

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

@Injectable()
export class AdminNotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create an admin notification (persisted to database)
   * Called by business logic services when events occur
   */
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

  /**
   * Get all admin notifications with filtering
   * Supports category filtering, pagination, read status
   */
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

  /**
   * Get notifications by category
   */
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

  /**
   * Get unread notifications only
   */
  async getUnread(page = 1, limit = 20): Promise<{
    notifications: AdminNotificationItem[]
    meta: { total: number; page: number; limit: number; totalPages: number; unreadCount: number }
  }> {
    return this.getAll({ isRead: false, page, limit })
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<AdminNotificationItem> {
    return this.prisma.adminNotification.update({
      where: { id },
      data: { isRead: true },
    })
  }

  /**
   * Mark multiple notifications as read
   */
  async markManyAsRead(ids: string[]): Promise<{ count: number }> {
    return this.prisma.adminNotification.updateMany({
      where: { id: { in: ids } },
      data: { isRead: true },
    })
  }

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(): Promise<{ count: number }> {
    return this.prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })
  }

  /**
   * Delete a notification
   */
  async delete(id: string): Promise<void> {
    await this.prisma.adminNotification.delete({
      where: { id },
    })
  }

  /**
   * Delete multiple notifications
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    return this.prisma.adminNotification.deleteMany({
      where: { id: { in: ids } },
    })
  }

  /**
   * Get summary stats
   */
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

  /**
   * Delete old notifications (older than X days)
   * For cleanup/archive purposes
   */
  async deleteOlderThan(days: number): Promise<{ count: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return this.prisma.adminNotification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true, // Only delete read ones to preserve recent activity
      },
    })
  }
}