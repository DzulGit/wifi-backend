import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ServiceRequestType } from '@prisma/client';

@Injectable()
export class ServiceRequestsService {
  constructor(private prisma: PrismaService) {}

  // 1. Cek status request terakhir user
  //    Mengembalikan 3 hal:
  //    - hasActiveRequest : apakah ada yang masih PENDING (untuk Lock Screen)
  //    - request          : data request yang PENDING (null kalau tidak ada)
  //    - lastRequest      : data request paling terakhir (APAPUN statusnya, untuk Interstitial Screen)
  async checkActiveRequest(userId: string) {
    const latestRequest = await this.prisma.serviceRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const isPending = latestRequest?.status === 'PENDING';

    return {
      hasActiveRequest: isPending,
      request: isPending ? latestRequest : null,
      lastRequest: latestRequest ?? null,
    };
  }

  // 2. Buat request baru (Ganti Paket, Pindah Alamat, Putus)
  async createRequest(
    userId: string,
    type: ServiceRequestType,
    requestData: Prisma.InputJsonValue,
  ) {
    // a. VALIDASI ANTI-SPAM — tolak jika masih ada yang PENDING
    const check = await this.checkActiveRequest(userId);
    if (check.hasActiveRequest) {
      throw new BadRequestException(
        `Permintaan sebelumnya (${check.request?.type}) masih dalam proses admin. Harap tunggu hingga selesai.`,
      );
    }

    // b. SIMPAN REQUEST KE DATABASE
    const newRequest = await this.prisma.serviceRequest.create({
      data: {
        userId,
        type,
        requestData,
      },
    });

    // c. AMBIL DATA USER UNTUK TEKS NOTIFIKASI
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, customerCode: true },
    });

    // d. LABEL TIPE REQUEST
    const requestTypeLabel =
      type === 'PACKAGE_CHANGE'
        ? 'Ganti Paket'
        : type === 'ADDRESS_MOVE'
          ? 'Pindah Alamat'
          : 'Putus Langganan';

    // e. KIRIM NOTIFIKASI KE DASHBOARD ADMIN
    await this.prisma.adminNotification.create({
      data: {
        title: `Pengajuan ${requestTypeLabel} Baru`,
        message: `Pelanggan ${user?.fullName} (${user?.customerCode}) mengajukan permohonan ${requestTypeLabel}. Segera tinjau pengajuan ini.`,
        category: 'ACCOUNT',
        link: '/admin/layanan',
        isUrgent: type === 'CANCELLATION',
      },
    });

    return newRequest;
  }

  // 3. Fungsi khusus Admin untuk Approve / Reject Pengajuan
  async updateRequestStatusByAdmin(requestId: string, status: 'APPROVED' | 'REJECTED', adminNotes?: string) {
    // a. Cari data request-nya dulu
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new BadRequestException('Data pengajuan tidak ditemukan.');
    }

    // b. Update data ServiceRequest beserta waktu diproses (processedAt)
    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminNotes,
        processedAt: new Date(), // 👈 Otomatis ngisi processedAt saat admin klik klik!
      },
    });

    // c. KHUSUS PUTUS LANGGANAN (CANCELLATION) & DI-APPROVED
    // Kita otomatis ubah status user-nya jadi INACTIVE agar hitungan cron job 3 bulan berjalan
    if (request.type === 'CANCELLATION' && status === 'APPROVED') {
      await this.prisma.user.update({
        where: { id: request.userId },
        data: { status: 'INACTIVE' }, // Menandakan pelanggan sudah berhenti berlangganan
      });
    }

    return updatedRequest;
  }
}