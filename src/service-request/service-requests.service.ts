import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceRequestType } from '@prisma/client';

@Injectable()
export class ServiceRequestsService {
  constructor(private prisma: PrismaService) {}

  // 1. Cek status request terakhir user
  async checkActiveRequest(userId: string) {
    // Cari 1 pengajuan paling terakhir berdasarkan tanggal dibuat (descending)
    const latestRequest = await this.prisma.serviceRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      // Lock screen nyala cuma kalau statusnya masih PENDING
      hasActiveRequest: latestRequest?.status === 'PENDING',
      request: latestRequest?.status === 'PENDING' ? latestRequest : null,
      
      // Kirim riwayat terakhir (buat nampilin banner REJECTED di frontend)
      lastRequest: latestRequest, 
    };
  }

  // 2. Buat request baru (Ganti Paket, Pindah Alamat, Putus)
  async createRequest(userId: string, type: ServiceRequestType, requestData: any) {
    // a. VALIDASI ANTI-SPAM
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

    // c. AMBIL DATA USER BUAT BIKIN TEKS NOTIFIKASI
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, customerCode: true },
    });

    // d. BIKIN TEKS LABEL BERDASARKAN TIPE REQUEST
    const requestTypeLabel = 
      type === 'PACKAGE_CHANGE' ? 'Ganti Paket' : 
      type === 'ADDRESS_MOVE' ? 'Pindah Alamat' : 
      'Putus Langganan';

    // e. KIRIM NOTIFIKASI KE DASHBOARD ADMIN
    await this.prisma.adminNotification.create({
      data: {
        title: `Pengajuan ${requestTypeLabel} Baru`,
        message: `Pelanggan ${user?.fullName} (${user?.customerCode}) mengajukan permohonan ${requestTypeLabel}. Segera tinjau pengajuan ini.`,
        category: 'ACCOUNT', // Memasukkan ke kategori akun
        link: '/admin/layanan', // 👈 Sesuaikan URL ini dengan halaman tabel request di frontend admin lu
        isUrgent: type === 'CANCELLATION', // Kalau putus langganan, tandai sebagai urgent (darurat)
      },
    });

    return newRequest;
  }
}