import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { NotificationsModule } from '../notifications/notifications.module'
import { GcsService } from '../gcs.service'

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, GcsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}