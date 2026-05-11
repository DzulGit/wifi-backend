import { Injectable } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  })
  
  // 1. Constructor cukup satu dan inisialisasi transporter di sini
  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
  }

  // FUNGSI DINAMIS UNTUK NOTIFIKASI APP
  async getAppNotifications(userId: string) {
    // 1. Ambil Tagihan (Invoice) yang UNPAID
    const invoices = await this.prisma.invoice.findMany({
      where: { userId, status: 'UNPAID' },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Ambil Balasan Tiket (TicketReply) dari Admin
    const adminReplies = await this.prisma.ticketReply.findMany({
      where: {
        ticket: { userId },
        isFromAdmin: true, // Sesuai kolom di schema kamu
      },
      include: { ticket: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    // 3. Mapping data Invoice ke format Notifikasi
    const invoiceNotifs = invoices.map((inv) => ({
      id: `inv-${inv.id}`,
      title: inv.penaltyAmount > 0 ? 'Peringatan Jatuh Tempo' : 'Tagihan Baru Terbit',
      message: inv.penaltyAmount > 0 
        ? `Tagihan ${inv.invoiceNumber} sudah lewat jatuh tempo. Denda Rp ${inv.penaltyAmount.toLocaleString()} ditambahkan.`
        : `Tagihan ${inv.invoiceNumber} sebesar Rp ${inv.totalAmount.toLocaleString()} sudah tersedia.`,
      type: inv.penaltyAmount > 0 ? 'WARNING' : 'BILLING',
      createdAt: inv.createdAt,
      isRead: false,
    }));

    // 4. Mapping data TicketReply ke format Notifikasi
    const chatNotifs = adminReplies.map((reply) => ({
      id: `reply-${reply.id}`,
      title: 'Pesan Baru dari Admin',
      message: reply.message.length > 50 ? `${reply.message.substring(0, 50)}...` : reply.message,
      type: 'INFO',
      createdAt: reply.createdAt,
      isRead: false,
    }));

    // 5. Gabungkan dan Urutkan berdasarkan tanggal terbaru
    return [...invoiceNotifs, ...chatNotifs].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  // Fungsi placeholder
  async markAsRead(id: string) {
    return { status: 'success' };
  }

  async sendOtpEmail(email: string, code: string, name: string) {
    await this.transporter.sendMail({
      from: `"WiFi Management" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Kode OTP Login Kamu',
      html: `
        <h2>Halo ${name}!</h2>
        <p>Kode OTP kamu adalah:</p>
        <h1 style="letter-spacing: 8px; color: #2563eb;">${code}</h1>
        <p>Kode berlaku <strong>5 menit</strong>. Jangan bagikan ke siapapun.</p>
      `,
    })
  }

  async sendActivationEmail(email: string, name: string, activationLink: string) {
  await this.transporter.sendMail({
    from: `"WiFi Management" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Aktifkan Akun WiFi Kamu',
    html: `
      <h2>Halo ${name}! 🎉</h2>
      <p>Pendaftaran kamu telah disetujui!</p>
      <p>Klik tombol di bawah untuk mengaktifkan akun dan membuat password:</p>
      <a href="${activationLink}" 
         style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">
        Aktifkan Akun
      </a>
      <p>Link berlaku <strong>7 hari</strong>.</p>
      <p>Jika kamu tidak merasa mendaftar, abaikan email ini.</p>
    `,
  })
}
async sendInvoiceEmail(
  email: string,
  name: string,
  invoiceNumber: string,
  amount: number,
  dueDate: Date,
) {
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(amount)

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
  }).format(dueDate)

  await this.transporter.sendMail({
    from: `"WiFi Management" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Tagihan WiFi ${invoiceNumber}`,
    html: `
      <h2>Halo ${name}!</h2>
      <p>Tagihan WiFi bulan ini sudah tersedia.</p>
      <table style="border-collapse:collapse;width:100%;max-width:400px">
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Nomor Invoice</td>
          <td style="padding:8px;border:1px solid #e5e7eb"><strong>${invoiceNumber}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Total Tagihan</td>
          <td style="padding:8px;border:1px solid #e5e7eb"><strong>${formattedAmount}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Jatuh Tempo</td>
          <td style="padding:8px;border:1px solid #e5e7eb"><strong>${formattedDate}</strong></td>
        </tr>
      </table>
      <p style="margin-top:16px">Segera lakukan pembayaran sebelum jatuh tempo untuk menghindari denda.</p>
    `,
  })
}

async sendPaymentConfirmationEmail(
  email: string,
  name: string,
  paymentCode: string,
  amount: number,
) {
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(amount)

  await this.transporter.sendMail({
    from: `"WiFi Management" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Pembayaran ${paymentCode} Berhasil`,
    html: `
      <h2>Halo ${name}! 🎉</h2>
      <p>Pembayaran kamu telah dikonfirmasi!</p>
      <table style="border-collapse:collapse;width:100%;max-width:400px">
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Kode Pembayaran</td>
          <td style="padding:8px;border:1px solid #e5e7eb"><strong>${paymentCode}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Jumlah</td>
          <td style="padding:8px;border:1px solid #e5e7eb"><strong>${formattedAmount}</strong></td>
        </tr>
      </table>
      <p style="margin-top:16px;color:#16a34a">✅ Internet kamu sudah aktif kembali!</p>
    `,
  })
}

}