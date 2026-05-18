import { Controller, Get, Post, Body, UseGuards, Req, Patch, Param } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestType } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

@Controller('service-requests')
@UseGuards(AuthGuard('jwt')) // 👈 Aktifkan guard auth kamu di sini agar bisa mengambil data user login
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  // 👇 INI YANG KURANG KEMAREN BANG: Endpoint untuk Admin menarik semua antrean
  @Get('admin/all')
  async getAllForAdmin() {
    return this.serviceRequestsService.getAllRequestsForAdmin();
  }

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

  // Endpoint untuk Admin memproses pengajuan (Taruh di paling bawah controller)
  @Patch(':id/process')
  async processRequestByAdmin(
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'REJECTED',
    @Body('adminNotes') adminNotes?: string,
  ) {
    return this.serviceRequestsService.updateRequestStatusByAdmin(id, status, adminNotes);
  }
}