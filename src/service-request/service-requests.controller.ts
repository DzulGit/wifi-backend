import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestType } from '@prisma/client';

@Controller('service-requests')
// @UseGuards(JwtAuthGuard) // 👈 Aktifkan guard auth kamu di sini agar bisa mengambil data user login
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  // Endpoint untuk ngecek status lock di frontend
  @Get('active')
  async getActiveRequest(@Req() req: any) {
    // Ambil userId dari token login (sesuaikan dengan struktur req.user kamu)
    const userId = req.user?.id || req.user?.sub; 
    return this.serviceRequestsService.checkActiveRequest(userId);
  }

  // Endpoint untuk mengirim pengajuan baru
  @Post()
  async createRequest(
    @Req() req: any,
    @Body('type') type: ServiceRequestType,
    @Body('requestData') requestData: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.serviceRequestsService.createRequest(userId, type, requestData);
  }
}