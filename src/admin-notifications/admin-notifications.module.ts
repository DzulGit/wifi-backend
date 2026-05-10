import { Module } from '@nestjs/common'
import { AdminNotificationsService } from './admin-notifications.service'
import { AdminNotificationsController } from './admin-notifications.controller'

@Module({
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService],
})
export class AdminNotificationsModule {}