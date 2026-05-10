import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminNotificationsService } from './admin-notifications.service'
import { AuthGuard } from '@nestjs/passport'

@UseGuards(AuthGuard('jwt'))
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private service: AdminNotificationsService) {}

  // GET /admin/notifications → semua notif 7 hari terakhir
  @Get()
  getAll() {
    return this.service.getAll()
  }

  // GET /admin/notifications/summary → hanya count per kategori (untuk badge)
  @Get('summary')
  getSummary() {
    return this.service.getSummary()
  }
}