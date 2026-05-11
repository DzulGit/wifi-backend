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
  
  // ==========================================
  constructor(private prisma: PrismaService) { 
    this.transporter = nodemailer.createTransport({
      // ... (kode bawaanmu biarkan saja)
    });
  }

  // ==========================================
  // 3. TAMBAHKAN 2 FUNGSI BARU INI DI BAWAH
  // ==========================================
  
  async getAppNotifications(userId: string) {
    // Menarik data murni sesuai struktur tabel SQL kamu
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    // Mengubah isRead sesuai struktur tabel SQL kamu
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
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