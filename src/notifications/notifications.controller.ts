import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications') // Sesuai URL frontend
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Query('userId') userId: string) {
    if (!userId) return { status: 'error', data: [] };
    const data = await this.notificationsService.getAppNotifications(userId);
    return { data };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    const data = await this.notificationsService.markAsRead(id);
    return { data };
  }
}
