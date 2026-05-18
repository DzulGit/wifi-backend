import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ServiceRequestType } from '@prisma/client';

@Injectable()
export class ServiceRequestsService {
  constructor(private prisma: PrismaService) {}

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

  async createRequest(
    userId: string,
    type: ServiceRequestType,
    requestData: Prisma.InputJsonValue,
  ) {
    const check = await this.checkActiveRequest(userId);
    if (check.hasActiveRequest) {
      throw new BadRequestException(
        `Permintaan sebelumnya (${check.request?.type}) masih dalam proses admin. Harap tunggu hingga selesai.`,
      );
    }

    const newRequest = await this.prisma.serviceRequest.create({
      data: {
        userId,
        type,
        requestData,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, customerCode: true },
    });

    const requestTypeLabel =
      type === 'PACKAGE_CHANGE'
        ? 'Ganti Paket'
        : type === 'ADDRESS_MOVE'
          ? 'Pindah Alamat'
          : 'Putus Langganan';

    // FIX: semua request type pakai category 'SYSTEM'
    // agar ter-fetch oleh permintaan/page.tsx yang query ?category=SYSTEM
    await this.prisma.adminNotification.create({
      data: {
        title: `Pengajuan ${requestTypeLabel} Baru`,
        message: `Pelanggan ${user?.fullName} (${user?.customerCode}) mengajukan permohonan ${requestTypeLabel}. Segera tinjau pengajuan ini.`,
        category: 'SYSTEM',
        link: '/admin/permintaan',
        isUrgent: type === 'CANCELLATION',
        metadata: {
          requestId: newRequest.id,
          userId: userId,
          ...(type === 'PACKAGE_CHANGE' && { newPackageId: (requestData as any).newPackageId }),
          ...(type === 'ADDRESS_MOVE' && { newAddress: (requestData as any).newAddress }),
          ...(type === 'CANCELLATION' && { reason: (requestData as any).reason }),
        },
      },
    });

    return newRequest;
  }

  async updateRequestStatusByAdmin(
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    adminNotes?: string,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new BadRequestException('Data pengajuan tidak ditemukan.');
    }

    if (status === 'APPROVED') {
      const dataReq = request.requestData as any;
      const updateUserData: any = {};

      if (request.type === 'CANCELLATION') {
        updateUserData.status = 'INACTIVE';
      } else if (request.type === 'PACKAGE_CHANGE' && dataReq?.newPackageId) {
        updateUserData.packageId = dataReq.newPackageId;
      } else if (request.type === 'ADDRESS_MOVE' && dataReq?.newAddress) {
        updateUserData.address = dataReq.newAddress;
      }

      if (Object.keys(updateUserData).length > 0) {
        await this.prisma.user.update({
          where: { id: request.userId },
          data: updateUserData,
        });
      }
    }

    return this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminNotes,
        processedAt: new Date(),
      },
    });
  }

  async getAllRequestsForAdmin() {
    return this.prisma.serviceRequest.findMany({
      include: {
        user: { select: { fullName: true, customerCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}