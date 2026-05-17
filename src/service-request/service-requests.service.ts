import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceRequestType } from '@prisma/client';

@Injectable()
export class ServiceRequestsService {
  constructor(private prisma: PrismaService) {}

  // 1. Cek apakah user memiliki request yang berstatus PENDING
  async checkActiveRequest(userId: string) {
    const activeRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        userId,
        status: 'PENDING',
      },
    });

    return {
      hasActiveRequest: !!activeRequest,
      request: activeRequest || null,
    };
  }

  // 2. Buat request baru (Ganti Paket, Pindah Alamat, Putus)
  async createRequest(userId: string, type: ServiceRequestType, requestData: any) {
    // VALIDASI ANTI-SPAM: Cek dulu apakah masih ada request PENDING
    const check = await this.checkActiveRequest(userId);
    if (check.hasActiveRequest) {
      throw new BadRequestException(
        `Permintaan sebelumnya (${check.request?.type}) masih dalam proses admin. Harap tunggu hingga selesai.`,
      );
    }

    // Jika aman, buat request baru ke database
    return this.prisma.serviceRequest.create({
      data: {
        userId,
        type,
        requestData,
      },
    });
  }
}