import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    private prisma: PrismaService,
    private adminNotifications: AdminNotificationsService,
  ) {}

  // Jalan otomatis setiap jam 00:00 (Tengah Malam)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkOverdueInvoices() {
    this.logger.log('Menjalankan pengecekan tagihan jatuh tempo...');
    const today = new Date();

    try {
      // 1. Cari tagihan yang belum dibayar dan udah lewat jatuh tempo
      const overdueInvoices = await this.prisma.invoice.findMany({
        where: {
          status: 'UNPAID', // Sesuaikan kalau di lu ada status 'PENDING' dll
          dueDate: { lt: today },
        },
        include: { user: true },
      });

      if (overdueInvoices.length === 0) {
        this.logger.log('Aman! Tidak ada pelanggan yang nunggak hari ini.');
        return;
      }

      let suspendedCount = 0;

      // 2. Loop tiap tagihan, isolir user-nya
      for (const invoice of overdueInvoices) {
        // Kalau user-nya udah keburu disuspend/nonaktif, lewatin aja
        if (invoice.user.status !== 'ACTIVE') continue;

        // Suspend user-nya
        await this.prisma.user.update({
          where: { id: invoice.userId },
          data: { status: 'SUSPENDED' },
        });

        // (Opsional) Lu juga bisa update status tagihannya jadi 'OVERDUE' di sini
        // await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'OVERDUE' } });

        suspendedCount++;
      }

      // 3. Tembak Notifikasi Massal ke Admin
      if (suspendedCount > 0) {
        await this.adminNotifications.create({
          title: '🔴 Auto-Suspend Massal',
          message: `Sistem otomatis mengisolir koneksi ${suspendedCount} pelanggan karena menunggak tagihan lebih dari jatuh tempo.`,
          category: 'BILLING',
          link: '/admin/pelanggan?status=SUSPENDED',
          isUrgent: true,
          metadata: { totalSuspended: suspendedCount },
        });

        this.logger.log(
          `Berhasil mengisolir ${suspendedCount} pelanggan yang nunggak.`,
        );
      }
    } catch (error) {
      this.logger.error('Gagal menjalankan cron job auto-suspend', error);
    }
  }
}
