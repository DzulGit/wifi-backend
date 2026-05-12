import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { NotificationsModule } from '../notifications/notifications.module'
import { GcsService } from '../gcs.service'
import { PrismaModule } from '../prisma/prisma.module' // Import Modulnya

@Module({
  imports: [
    NotificationsModule, 
    PrismaModule // <--- 1. Masukin Modulnya ke sini
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService, 
    GcsService 
    // 2. PrismaService HAPUS dari sini, karena udah di-handle PrismaModule
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}