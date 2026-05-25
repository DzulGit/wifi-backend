import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('isRead') isRead?: string, // 👈 Tangkap parameter dari URL (opsional)
  ) {
    const userId = req.user.id;

    // Ubah string 'true'/'false' dari URL menjadi tipe boolean yang asli
    let readFilter: boolean | undefined = undefined;
    if (isRead === 'true') readFilter = true;
    if (isRead === 'false') readFilter = false;

    const data = await this.notificationsService.getAppNotifications(
      userId,
      readFilter,
    );
    return { data };
  }

  // 👈 PENTING: Harus ditaruh di atas route ':id/read' agar tidak dianggap sebagai ID
  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.id;
    const data = await this.notificationsService.markAllAsRead(userId);
    return { message: 'Semua notifikasi berhasil ditandai dibaca', data };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const data = await this.notificationsService.markAsRead(id, userId);
    return { data };
  }

  @Delete('delete-all')
  async deleteAll(@Request() req: any) {
    const userId = req.user.id;
    // 2️⃣ Kita oper eksekusinya ke Service, BUKAN panggil prisma di sini
    const data = await this.notificationsService.deleteAll(userId);
    return { message: 'Semua notifikasi berhasil dihapus', data };
  }
  // Endpoint untuk fitur hapus (soft delete)
  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const data = await this.notificationsService.softDelete(id, userId);
    return { message: 'Notifikasi berhasil dihapus', data };
  }
}
