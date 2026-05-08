import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Generate payment code ─────────────────────────────────
  private async generatePaymentCode(): Promise<string> {
    const count = await this.prisma.payment.count()
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    return `PAY-${year}${month}-${String(count + 1).padStart(4, '0')}`
  }

  // ── Submit pembayaran (oleh user) ─────────────────────────
  async submit(userId: string, data: {
    invoiceId: string
    method: string
    proofImageUrl?: string
    notes?: string
  }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { user: true },
    })
    if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan')
    if (invoice.userId !== userId) throw new BadRequestException('Tagihan bukan milik kamu')
    if (invoice.status === 'PAID') throw new BadRequestException('Tagihan sudah lunas')

    // Cek apakah ada pembayaran pending sebelumnya
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
        amount: invoice.totalAmount,
        method: data.method as any,
        status: 'PENDING',
        proofImageUrl: data.proofImageUrl,
        notes: data.notes,
      },
      include: { invoice: true },
    })

    // Update status invoice jadi pending
    await this.prisma.invoice.update({
      where: { id: data.invoiceId },
      data: { status: 'PENDING' },
    })

    return {
      message: 'Pembayaran berhasil dikirim, menunggu validasi admin',
      payment,
    }
  }

  // ── Approve pembayaran (oleh admin) ──────────────────────
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

    // Update payment status
    await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        processedById: adminId,
        processedAt: new Date(),
      },
    })

    // Update invoice status jadi PAID
    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    })

    // Aktifkan user jika suspended karena nunggak
    if (payment.user.status === 'SUSPENDED') {
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { status: 'ACTIVE' },
      })
    }

    // Kirim notifikasi email
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

  // ── Reject pembayaran (oleh admin) ────────────────────────
  async reject(id: string, adminId: string, reason: string) {
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
        rejectedReason: reason,
      },
    })

    // Kembalikan status invoice ke UNPAID
    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'UNPAID' },
    })

    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'UNPAID' },
    })

    return { message: 'Pembayaran ditolak, tagihan dikembalikan ke unpaid' }
  }

  // ── Get all payments ──────────────────────────────────────
  async findAll(query: {
    status?: string
    userId?: string
    page?: number
    limit?: number
  }) {
    const { status, userId, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (userId) where.userId = userId

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, customerCode: true } },
          invoice: { select: { invoiceNumber: true, billingMonth: true, billingYear: true } },
          processedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ])

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  // ── Get one payment ───────────────────────────────────────
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

  // ── Stats pembayaran ──────────────────────────────────────
  async getStats() {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({ where: { status: 'APPROVED' } }),
      this.prisma.payment.count({ where: { status: 'REJECTED' } }),
    ])
    return { pending, approved, rejected }
  }
}