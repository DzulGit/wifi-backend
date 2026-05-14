import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { NotificationsModule } from '../notifications/notifications.module'
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module'

@Module({
  imports: [NotificationsModule, AdminNotificationsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}