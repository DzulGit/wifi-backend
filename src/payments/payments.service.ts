import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Generate payment code with retry logic ────────────────────────────────
  private async generatePaymentCode(): Promise<string> {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const maxAttempts = 5

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const count = await this.prisma.payment.count()
      const paymentCode = `PAY-${year}${month}-${String(count + 1 + attempt).padStart(4, '0')}`
      
      const existing = await this.prisma.payment.findUnique({
        where: { paymentCode },
      })
      
      if (!existing) {
        return paymentCode
      }
    }

    // Fallback: append timestamp for absolute uniqueness
    const timestamp = Date.now()
    return `PAY-${year}${month}-${String(timestamp).slice(-4)}`
  }

  // ── Submit pembayaran (oleh user) ─────────────────────────────────────────
  async submit(
    userId: string,
    data: {
      invoiceId: string
      method: string
      proofImageUrl?: string
      notes?: string
    },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { user: true },
    })

    if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan')

    // SECURITY FIX: Pastikan invoice milik user yang sedang login
    if (invoice.userId !== userId) {
      throw new BadRequestException('Tagihan bukan milik kamu')
    }

    if (invoice.status === 'PAID') throw new BadRequestException('Tagihan sudah lunas')

    const pendingPayment = await this.prisma.payment.findFirst({
      where: { invoiceId: data.invoiceId, status: 'PENDING' },
    })

    if (pendingPayment) {
      throw new BadRequestException('Pembayaran sedang menunggu validasi admin')
    }

    const paymentCode = await this.generatePaymentCode()

    const payment = await this.prisma.payment.create({
      data: {
        paymentCode,
        invoiceId: data.invoiceId,
        userId,
        amount: invoice.totalAmount, // Pakai amount dari invoice, bukan dari input user
        method: data.method as any,
        status: 'PENDING',
        proofImageUrl: data.proofImageUrl,
        notes: data.notes,
      },
      include: { invoice: true },
    })

    await this.prisma.invoice.update({
      where: { id: data.invoiceId },
      data: { status: 'PENDING' },
    })

    return {
      message: 'Pembayaran berhasil dikirim, menunggu validasi admin',
      payment,
    }
  }

  // ── Approve pembayaran (oleh admin) ──────────────────────────────────────
  async approve(id: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
        user: true,
      },
    })

    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan')
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Pembayaran sudah diproses sebelumnya')
    }

    // Wrap database updates in transaction for data consistency
    await this.prisma.$transaction(async (tx) => {
      // Update payment status to APPROVED
      await tx.payment.update({
        where: { id },
        data: {
          status: 'APPROVED',
          processedById: adminId,
          processedAt: new Date(),
        },
      })

      // Update invoice status to PAID
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      })

      // Reactivate user if suspended
      if (payment.user.status === 'SUSPENDED') {
        await tx.user.update({
          where: { id: payment.userId },
          data: { status: 'ACTIVE' },
        })
      }
    })

    // Send email notification after transaction succeeds
    if (payment.user.email) {
      await this.notifications.sendPaymentConfirmationEmail(
        payment.user.email,
        payment.user.fullName,
        payment.paymentCode,
        payment.amount,
      )
    }

    return { message: 'Pembayaran diapprove, tagihan lunas' }
  }

  // ── Reject pembayaran (oleh admin) ────────────────────────────────────────
  async reject(id: string, adminId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Alasan penolakan wajib diisi')
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    })

    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan')
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Pembayaran sudah diproses sebelumnya')
    }

    await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        processedById: adminId,
        processedAt: new Date(),
        rejectedReason: reason.trim(),
      },
    })

    // BUG FIX: Update invoice hanya sekali (sebelumnya double update)
    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'UNPAID' },
    })

    return { message: 'Pembayaran ditolak, tagihan dikembalikan ke unpaid' }
  }

  // ── Get all payments ──────────────────────────────────────────────────────
  async findAll(query: {
    status?: string
    userId?: string
    page?: number
    limit?: number
  }) {
    const { status, userId, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    // SECURITY FIX: Batasi limit maksimum
    const safeLimit = Math.min(limit, 100)

    const where: any = {}
    if (status) where.status = status
    if (userId) where.userId = userId

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, customerCode: true } },
          invoice: {
            select: { invoiceNumber: true, billingMonth: true, billingYear: true },
          },
          processedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ])

    return {
      data,
      meta: { total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
    }
  }

  // ── Get one payment ───────────────────────────────────────────────────────
  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: true,
        invoice: { include: { package: true } },
        processedBy: { select: { fullName: true } },
      },
    })
    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan')
    return payment
  }

  // ── Stats pembayaran ──────────────────────────────────────────────────────
  async getStats() {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    const [pending, approved, rejected, totalApproved] = await Promise.all([
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({ where: { status: 'APPROVED' } }),
      this.prisma.payment.count({ where: { status: 'REJECTED' } }),
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
      pending,
      approved,
      rejected,
      totalAmountApproved: totalApproved._sum.amount ?? 0,
    }
  }
}
