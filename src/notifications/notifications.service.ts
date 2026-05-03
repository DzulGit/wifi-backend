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
}