import { Module } from '@nestjs/common'
import { RegistrationsService } from './registrations.service'
import { RegistrationsController } from './registrations.controller'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}