import { Injectable } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class NotificationsService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  })

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
}