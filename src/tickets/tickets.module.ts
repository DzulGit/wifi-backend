import { Module } from '@nestjs/common'
import { TicketsService } from './tickets.service'
import { TicketsController } from './tickets.controller'
import { NotificationsModule } from '../notifications/notifications.module' // <-- IMPORT MODULE NOTIFIKASI

@Module({
  imports: [NotificationsModule], // <-- MASUKIN MODULE NOTIFIKASI
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}