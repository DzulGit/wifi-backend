import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Robot ini akan berjalan setiap jam 01:00 dini hari
  // (Ubah jadi CronExpression.EVERY_MINUTE kalau mau ngetes cepat)
  @Cron('0 1 * * *')
  async handleInvoiceReminders() {
    this.logger.log('Menjalankan robot pengecekan tagihan...');

    // Ambil tanggal hari ini (jam 00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Cari semua invoice yang belum dibayar
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: { status: 'UNPAID' },
      include: { package: true, user: true },
    });

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Hitung selisih hari
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let reminderTitle = '';
      let reminderMessage = '';

      // Logika H-7, H-3, H-1, dan Lewat Jatuh Tempo
      if (diffDays === 7) {
        reminderTitle = 'Tagihan Mendekati Jatuh Tempo (H-7)';
        reminderMessage = `Tagihan internet Anda untuk paket ${invoice.package.name} sebesar Rp ${invoice.totalAmount.toLocaleString('id-ID')} akan jatuh tempo dalam 7 hari.`;
      } else if (diffDays === 3) {
        reminderTitle = 'Tagihan Mendekati Jatuh Tempo (H-3)';
        reminderMessage = `Jangan lupa! Tagihan sebesar Rp ${invoice.totalAmount.toLocaleString('id-ID')} akan jatuh tempo dalam 3 hari. Yuk, segera lunasi.`;
      } else if (diffDays === 1) {
        reminderTitle = 'Besok Jatuh Tempo! (H-1)';
        reminderMessage = `Peringatan: Tagihan internet Anda akan jatuh tempo BESOK. Mohon segera selesaikan pembayaran untuk menghindari denda.`;
      } else if (diffDays === -1) {
        // H+1 Lewat jatuh tempo
        reminderTitle = 'Tagihan Melewati Batas Waktu!';
        reminderMessage = `Tagihan Anda telah melewati tanggal jatuh tempo. Segera lunasi agar layanan internet Anda tidak terisolir.`;
      }

      // Jika ada kriteria yang masuk, tembak notifikasi ke user!
      if (reminderTitle) {
        await this.notificationsService.createNotification({
          userId: invoice.userId,
          type: NotificationType.INVOICE_REMINDER,
          title: reminderTitle,
          message: reminderMessage,
          metadata: { url: `/dashboard/tagihan/${invoice.id}` }, // 👈 Langsung nge-link ke detail invoice!
        });
        this.logger.log(
          `[Berhasil] Reminder ${reminderTitle} dikirim ke ${invoice.user.fullName}`,
        );
      }
    }
  }
}
