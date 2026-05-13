import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Request() req: any) {
    // SECURITY FIX: userId diambil dari JWT token, bukan dari query parameter
    // Ini mencegah IDOR — user hanya bisa lihat notifikasinya sendiri
    const userId = req.user.id;
    const data = await this.notificationsService.getAppNotifications(userId);
    return { data };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const data = await this.notificationsService.markAsRead(id, userId);
    return { data };
  }
}
