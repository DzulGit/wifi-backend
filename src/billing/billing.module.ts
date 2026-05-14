import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { NotificationsModule } from '../notifications/notifications.module'
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module'
import { BillingScheduler } from './billing.scheduler';

@Module({
  imports: [NotificationsModule, AdminNotificationsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService, BillingScheduler],
})
export class BillingModule {}