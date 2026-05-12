import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Generate invoice number with retry logic ──────────────
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const maxAttempts = 5

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const count = await this.prisma.invoice.count()
      const invoiceNumber = `INV-${year}${month}-${String(count + 1 + attempt).padStart(4, '0')}`
      
      const existing = await this.prisma.invoice.findUnique({
        where: { invoiceNumber },
      })
      
      if (!existing) {
        return invoiceNumber
      }
    }

    // Fallback: append timestamp for absolute uniqueness
    const timestamp = Date.now()
    return `INV-${year}${month}-${String(timestamp).slice(-4)}`
  }

  // ── Generate tagihan untuk 1 user ─────────────────────────
  async generateInvoice(userId: string, adminId: string, billingMonth?: number, billingYear?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { package: true },
    })
    if (!user) throw new NotFoundException('User tidak ditemukan')
    if (!user.package) throw new BadRequestException('User belum assign paket')
    if (user.status === 'INACTIVE') throw new BadRequestException('User tidak aktif')

    const month = billingMonth ?? new Date().getMonth() + 1
    const year = billingYear ?? new Date().getFullYear()

    // Cek tagihan bulan ini sudah ada
    const existing = await this.prisma.invoice.findUnique({
      where: { userId_billingMonth_billingYear: { userId, billingMonth: month, billingYear: year } },
    })
    if (existing) throw new BadRequestException('Tagihan bulan ini sudah dibuat')

    // Ambil setting jatuh tempo
    const dueSetting = await this.prisma.setting.findUnique({
      where: { key: 'billing_due_days' },
    })
    const dueDays = parseInt(dueSetting?.value ?? '10')
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)

    const invoiceNumber = await this.generateInvoiceNumber()
    const amount = user.package.price

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        userId,
        packageId: user.package.id,
        amount,
        totalAmount: amount,
        billingMonth: month,
        billingYear: year,
        dueDate,
        status: 'UNPAID',
        generatedById: adminId,
      },
      include: { user: true, package: true },
    })

    // Kirim notifikasi email
    if (user.email) {
      await this.notifications.sendInvoiceEmail(
        user.email,
        user.fullName,
        invoiceNumber,
        amount,
        dueDate,
      )
    }

    return invoice
  }

  // ── Generate tagihan massal semua user aktif ──────────────
  async generateBulkInvoices(adminId: string, billingMonth?: number, billingYear?: number) {
    const month = billingMonth ?? new Date().getMonth() + 1
    const year = billingYear ?? new Date().getFullYear()

    const activeUsers = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', packageId: { not: null } },
    })

    const results = { success: 0, skipped: 0, errors: [] as string[] }

    for (const user of activeUsers) {
  try {
    await this.generateInvoice(user.id, adminId, month, year)
    results.success++
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('sudah dibuat')) {
        results.skipped++
      } else {
        results.errors.push(`${user.customerCode}: ${e.message}`)
      }
    } else {
      results.errors.push(`${user.customerCode}: Unknown error`)
    }
  }
}

    return {
      message: `Generate selesai: ${results.success} berhasil, ${results.skipped} dilewati`,
      ...results,
    }
  }

  // ── Get all invoices ──────────────────────────────────────
  async findAll(query: {
    status?: string
    userId?: string
    month?: number
    year?: number
    page?: number
    limit?: number
  }) {
    const { status, userId, month, year, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (userId) where.userId = userId
    if (month) where.billingMonth = month
    if (year) where.billingYear = year

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, customerCode: true, phone: true } },
          package: { select: { name: true, price: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ])

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  // ── Get one invoice ───────────────────────────────────────
  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        user: true,
        package: true,
        payments: true,
        generatedBy: { select: { fullName: true } },
      },
    })
    if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan')
    return invoice
  }

  // ── Tambah denda ──────────────────────────────────────────
  async addPenalty(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } })
    if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan')
    if (invoice.status === 'PAID') throw new BadRequestException('Tagihan sudah lunas')

    const penaltySetting = await this.prisma.setting.findUnique({
      where: { key: 'penalty_amount' },
    })
    const penalty = parseInt(penaltySetting?.value ?? '10000')

    return this.prisma.invoice.update({
      where: { id },
      data: {
        penaltyAmount: { increment: penalty },
        totalAmount: { increment: penalty },
        status: 'OVERDUE',
      },
    })
  }

  // ── Stats billing ─────────────────────────────────────────
  async getStats() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [unpaid, pending, paid, overdue, totalRevenue] = await Promise.all([
    this.prisma.invoice.count({ where: { status: 'UNPAID' } }),
    this.prisma.invoice.count({ where: { status: 'PENDING' } }),
    this.prisma.invoice.count({ where: { status: 'PAID' } }),
    this.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    // Fix: hitung dari payments APPROVED bulan ini, bukan invoice PAID
    this.prisma.payment.aggregate({
      where: {
        status: 'APPROVED',
        processedAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      _sum: { amount: true },
    }),
  ])

    return {
      unpaid, pending, paid, overdue,
      totalRevenueThisMonth: totalRevenue._sum.amount ?? 0,
    }
  }
}