import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.ticket.create({
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

    return reply
  }

  // ── Update status tiket ───────────────────────────────────
  async updateStatus(id: string, status: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan')

    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: status as any,
        resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
      },
    })
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