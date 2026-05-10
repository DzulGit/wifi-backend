import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface NotificationItem {
  id: string
  type: 'PAYMENT' | 'REGISTRATION' | 'TICKET' | 'INVOICE'
  title: string
  message: string
  link: string
  createdAt: Date
  isUrgent: boolean
}

@Injectable()
export class AdminNotificationsService {
  constructor(private prisma: PrismaService) {}

  async getAll(): Promise<{ notifications: NotificationItem[]; totalUnread: number }> {
    const since = new Date()
    since.setDate(since.getDate() - 7) // Ambil notif 7 hari terakhir

    const [pendingPayments, pendingRegistrations, openTickets, overdueInvoices] =
      await Promise.all([
        // Pembayaran pending (butuh approve)
        this.prisma.payment.findMany({
          where: { status: 'PENDING', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { fullName: true, customerCode: true } },
            invoice: { select: { invoiceNumber: true } },
          },
        }),

        // Pendaftaran baru pending
        this.prisma.registration.findMany({
          where: { status: 'PENDING', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),

        // Tiket open yang belum dibalas
        this.prisma.ticket.findMany({
          where: { status: 'OPEN', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { fullName: true, customerCode: true } },
          },
        }),

        // Tagihan overdue
        this.prisma.invoice.findMany({
          where: { status: 'OVERDUE', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { fullName: true, customerCode: true } },
          },
        }),
      ])

    const notifications: NotificationItem[] = [
      ...pendingPayments.map((p) => ({
        id: `pay-${p.id}`,
        type: 'PAYMENT' as const,
        title: 'Pembayaran Masuk',
        message: `${p.user.fullName} (${p.user.customerCode}) kirim bukti bayar ${p.invoice.invoiceNumber}`,
        link: '/admin/pembayaran',
        createdAt: p.createdAt,
        isUrgent: false,
      })),

      ...pendingRegistrations.map((r) => ({
        id: `reg-${r.id}`,
        type: 'REGISTRATION' as const,
        title: 'Pendaftar Baru',
        message: `${r.fullName} (${r.phone}) mendaftar layanan WiFi`,
        link: '/admin/pendaftar',
        createdAt: r.createdAt,
        isUrgent: false,
      })),

      ...openTickets.map((t) => ({
        id: `tkt-${t.id}`,
        type: 'TICKET' as const,
        title: 'Tiket Baru',
        message: `${t.user.fullName}: "${t.title}"`,
        link: '/admin/tiket',
        createdAt: t.createdAt,
        isUrgent: t.priority === 'HIGH' || t.priority === 'CRITICAL',
      })),

      ...overdueInvoices.map((inv) => ({
        id: `inv-${inv.id}`,
        type: 'INVOICE' as const,
        title: 'Tagihan Overdue',
        message: `${inv.user.fullName} (${inv.user.customerCode}) tagihan jatuh tempo`,
        link: '/admin/tagihan',
        createdAt: inv.createdAt,
        isUrgent: true,
      })),
    ]

    // Sort by newest
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return {
      notifications: notifications.slice(0, 30),
      totalUnread: notifications.length,
    }
  }

  async getSummary() {
    const [payments, registrations, tickets, invoices] = await Promise.all([
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.registration.count({ where: { status: 'PENDING' } }),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    ])

    return {
      payments,
      registrations,
      tickets,
      invoices,
      total: payments + registrations + tickets + invoices,
    }
  }
}