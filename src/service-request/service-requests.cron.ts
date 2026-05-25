import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceRequestsCron {
  private readonly logger = new Logger(ServiceRequestsCron.name);

  constructor(private prisma: PrismaService) {}

  // Cron job berjalan setiap hari pada jam 00:00 (Tengah Malam)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleUserLifecycleAutomation() {
    this.logger.log('Memulai otomatisasi pemeriksaan status akun pelanggan...');

    const kini = new Date();

    // 1. HITUNG BATAS WAKTU (3 Bulan & 6 Bulan Lalu)
    const batasSuspend = new Date();
    batasSuspend.setMonth(kini.getMonth() - 3); // 3 bulan yang lalu

    const batasHapus = new Date();
    batasHapus.setMonth(kini.getMonth() - 6); // 6 bulan yang lalu (3 bulan setelah suspend)

    try {
      // ===================================================================
      // TAHAP 1: VALIDASI SUSPEND (3 Bulan Gak Langganan Lagi)
      // ===================================================================

      // Cari user aktif/nonaktif biasa yang request putus langganannya sudah di-approve >= 3 bulan lalu
      const userAkanSuspend = await this.prisma.user.findMany({
        where: {
          status: { in: ['ACTIVE', 'INACTIVE'] }, // Sesuaikan dengan enum status User di projekmu
          ServiceRequest: {
            // 👈 INI YANG DIGANTI (Huruf 'S' besar, tanpa 's' di akhir)
            some: {
              type: 'CANCELLATION',
              status: 'APPROVED',
              processedAt: { lte: batasSuspend },
            },
          },
        },
        select: { id: true, fullName: true },
      });

      if (userAkanSuspend.length > 0) {
        const ids = userAkanSuspend.map((u) => u.id);

        // Update status user menjadi SUSPENDED
        await this.prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { status: 'SUSPENDED' }, // Pastikan 'SUSPENDED' udah ditambahin di schema.prisma
        });

        this.logger.log(
          `Berhasil men-suspend ${userAkanSuspend.length} akun karena 3 bulan tidak berlangganan.`,
        );
      }

      // ===================================================================
      // TAHAP 2: VALIDASI PENGHAPUSAN / ARCHIVE (6 Bulan Total Gak Langganan)
      // ===================================================================

      // Cari user yang statusnya sudah SUSPENDED dan request putus langganannya sudah lewat 6 bulan
      const userAkanDihapus = await this.prisma.user.findMany({
        where: {
          status: 'SUSPENDED',
          ServiceRequest: {
            // 👈 INI JUGA DIGANTI (Huruf 'S' besar, tanpa 's' di akhir)
            some: {
              type: 'CANCELLATION',
              status: 'APPROVED',
              processedAt: { lte: batasHapus },
            },
          },
        },
        select: { id: true, fullName: true },
      });

      if (userAkanDihapus.length > 0) {
        const ids = userAkanDihapus.map((u) => u.id);

        // Opsi B: Soft Delete / Archive (Ubah status ke DELETED / ARCHIVED) -> PALING AMAN buat riwayat finance/billing
        await this.prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { status: 'DELETED' }, // Pastikan 'DELETED' udah ditambahin di schema.prisma
        });

        this.logger.log(
          `Berhasil menghapus/mengarsipkan ${userAkanDihapus.length} akun yang melewati masa tenggang 6 bulan.`,
        );
      }
    } catch (error) {
      this.logger.error('Gagal menjalankan otomatisasi lifecycle akun:', error);
    }

    this.logger.log('Otomatisasi pemeriksaan status akun selesai.');
  }
}
