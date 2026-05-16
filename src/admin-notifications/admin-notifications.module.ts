import { Module } from '@nestjs/common'
import { AdminNotificationsService } from './admin-notifications.service'
import { AdminNotificationsController } from './admin-notifications.controller'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}