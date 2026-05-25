import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
  }

  // ===========================================================================
  // 1. FUNGSI UNTUK FRONTEND (GET, READ, & DELETE)
  // ===========================================================================

  async getAppNotifications(userId: string, isRead?: boolean) {
    // Siapkan kondisi pencarian dasar
    const whereClause: any = {
      userId,
      isDeleted: false, // 👈 PENTING: Hanya tampilkan yang belum dihapus
    };

    // Jika frontend mengirim parameter isRead (true/false)
    if (isRead !== undefined) {
      whereClause.isRead = isRead;
    }

    return this.prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50, // Batasi 50 notif terbaru agar ringan
    });
  }

  async markAsRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');

    // Keamanan: Pastikan user hanya bisa membaca notifikasinya sendiri
    if (notif.userId !== userId) {
      throw new ForbiddenException('Anda tidak berhak membaca notifikasi ini');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // Fungsi baru: Tandai semua sudah dibaca
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        isDeleted: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // Fungsi baru: Soft delete notifikasi
  async softDelete(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');

    if (notif.userId !== userId) {
      throw new ForbiddenException(
        'Anda tidak berhak menghapus notifikasi ini',
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // Fitur hapus semua notifikasi milik user
  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId: userId },
    });
  }

  // ===========================================================================
  // 2. FUNGSI SAKTI UNTUK MEMBUAT NOTIFIKASI (Dipakai oleh service lain)
  // ===========================================================================

  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
      },
    });
  }

  // ===========================================================================
  // 3. FUNGSI EMAIL BAWAAN
  // ===========================================================================

  async sendOtpEmail(email: string, code: string, name: string) {
    try {
      await this.transporter.sendMail({
        from: `"CAKRANA WiFi" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Kode OTP Login Kamu - ${code}`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#1A1A1A;padding:20px;border-radius:12px;text-align:center;margin-bottom:24px">
            <h1 style="color:#F5A623;margin:0;letter-spacing:2px">CAKRANA</h1>
          </div>
          <h2>Halo, ${name}!</h2>
          <p>Kode OTP kamu:</p>
          <div style="background:#F4F4F5;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
            <p style="margin:0;font-size:40px;font-weight:bold;letter-spacing:12px;color:#1A1A1A">${code}</p>
          </div>
          <p style="color:#888;font-size:12px;text-align:center">
            Berlaku <strong>5 menit</strong>. Jangan bagikan ke siapapun.
          </p>
        </div>
      `,
      });
      console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send OTP email to ${email}:`, error);
    }
  }

  async sendActivationEmail(
    email: string,
    name: string,
    activationLink: string,
  ) {
    try {
      await this.transporter.sendMail({
        from: `"CAKRANA WiFi" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Aktifkan Akun CAKRANA Kamu',
        html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#1A1A1A;padding:20px;border-radius:12px;text-align:center;margin-bottom:24px">
            <h1 style="color:#F5A623;margin:0;letter-spacing:2px">CAKRANA</h1>
          </div>
          <h2>Selamat datang, ${name}! 🎉</h2>
          <p>Pendaftaran kamu telah disetujui. Klik tombol di bawah untuk mengaktifkan akun:</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${activationLink}"
              style="background:#F5A623;color:#1A1A1A;padding:14px 32px;border-radius:10px;
                     text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
              Aktifkan Akun →
            </a>
          </div>
          <p style="color:#888;font-size:12px">Link berlaku <strong>7 hari</strong>.</p>
        </div>
      `,
      });
      console.log(`✅ Activation email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send activation email to ${email}:`, error);
    }
  }
}
