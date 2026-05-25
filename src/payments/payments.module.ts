import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';
import { GcsService } from '../gcs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [NotificationsModule, AdminNotificationsModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, GcsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
