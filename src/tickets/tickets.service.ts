import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service'
import { AdminNotificationHelper } from '../admin-notifications/admin-notification.helper'

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private adminNotifications: AdminNotificationsService,
  ) {}

  // ── Generate ticket number with retry logic ───────────────
  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const maxAttempts = 5

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const count = await this.prisma.ticket.count()
      const ticketNumber = `TKT-${year}${month}-${String(count + 1 + attempt).padStart(4, '0')}`
      
      const existing = await this.prisma.ticket.findUnique({
        where: { ticketNumber },
      })
      
      if (!existing) {
        return ticketNumber
      }
    }

    // Fallback: append timestamp for absolute uniqueness
    const timestamp = Date.now()
    return `TKT-${year}${month}-${String(timestamp).slice(-4)}`
  }

  // ── Buat tiket (oleh user) ────────────────────────────────
  async create(userId: string, data: {
    title: string
    description: string
    category: string
    priority?: string
    attachmentUrl?: string
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User tidak ditemukan')

    const ticketNumber = await this.generateTicketNumber()

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: (data.priority as any) ?? 'MEDIUM',
        attachmentUrl: data.attachmentUrl,
        status: 'OPEN',
      },
    })

    // 👇 ADMIN NOTIFICATION 👇
    await AdminNotificationHelper.ticketCreated(this.adminNotifications, {
      userName: user.fullName,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      priority: ticket.priority,
      ticketId: ticket.id,
    });
    // 👆 SELESAI 👆

    return ticket
  }

  // ── Get all tickets ───────────────────────────────────────
  async findAll(query: {
    status?: string
    priority?: string
    userId?: string
    page?: number
    limit?: number
  }) {
    const { status, priority, userId, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (userId) where.userId = userId

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, customerCode: true, phone: true } },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ])

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  // ── Get one ticket ────────────────────────────────────────
  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, customerCode: true, phone: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            admin: { select: { fullName: true } },
          },
        },
      },
    })
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan')
    return ticket
  }

  // ── Balas tiket ───────────────────────────────────────────
  async reply(ticketId: string, data: {
    message: string
    isFromAdmin: boolean
    userId?: string
    adminId?: string
    attachmentUrl?: string
  }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan')
    if (ticket.status === 'CLOSED') throw new BadRequestException('Tiket sudah ditutup')

    // SECURITY FIX: Ownership check - non-admin users can only reply to their own tickets
    if (!data.isFromAdmin && data.userId && ticket.userId !== data.userId) {
      throw new ForbiddenException('Tidak memiliki akses ke tiket ini')
    }

    const reply = await this.prisma.ticketReply.create({
      data: {
        ticketId,
        message: data.message,
        isFromAdmin: data.isFromAdmin,
        adminId: data.adminId,
        attachmentUrl: data.attachmentUrl,
      },
    })

    // Update status tiket jadi IN_PROGRESS jika dibalas admin
    if (data.isFromAdmin && ticket.status === 'OPEN') {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' },
      })
    }

    // 👇 1. NOTIFIKASI BALASAN TIKET DITANAM DI SINI 👇
    if (data.isFromAdmin) {
      await this.notifications.createNotification({
        userId: ticket.userId,
        type: 'TICKET_REPLIED' as any,
        title: 'Tiket Dibalas Admin 🎧',
        message: `Admin telah membalas tiket pengaduan kamu (#${ticket.ticketNumber}). Silakan cek balasan terbaru.`,
        metadata: { ticketId: ticket.id }
      });

      // 👇 ADMIN NOTIFICATION (INFO: Someone replied to ticket) 👇
      const admin = await this.prisma.admin.findUnique({
        where: { id: data.adminId || '' },
      })
      if (admin) {
        await AdminNotificationHelper.ticketReplied(this.adminNotifications, {
          ticketNumber: ticket.ticketNumber,
          replierName: admin.fullName,
          ticketId: ticket.id,
        });
      }
      // 👆 SELESAI 👆
    }
    // 👆 SELESAI 👆

    return reply
  }

  // ── Update status tiket ───────────────────────────────────
  async updateStatus(id: string, status: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan')

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: status as any,
        resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
      },
    })

    // 👇 2. NOTIFIKASI UPDATE STATUS DITANAM DI SINI 👇
    if (status === 'RESOLVED' || status === 'CLOSED') {
      await this.notifications.createNotification({
        userId: ticket.userId,
        type: 'TICKET_REPLIED' as any,
        title: 'Status Pengaduan Diperbarui ✅',
        message: `Tiket pengaduan kamu (#${ticket.ticketNumber}) sekarang berstatus ${status}. Terima kasih telah menghubungi kami.`,
        metadata: { ticketId: ticket.id }
      });
    }
    // 👆 SELESAI 👆

    return updatedTicket
  }

  // ── Stats tiket ───────────────────────────────────────────
  async getStats() {
    const [open, inProgress, resolved, closed] = await Promise.all([
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.ticket.count({ where: { status: 'CLOSED' } }),
    ])
    return { open, inProgress, resolved, closed, total: open + inProgress + resolved + closed }
  }
}