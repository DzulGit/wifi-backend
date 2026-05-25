import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller'; 
import { PrismaModule } from '../prisma/prisma.module'; 
import { ReminderService } from './reminder.service';

@Module({
  imports: [PrismaModule], 
  controllers: [NotificationsController],
  providers: [NotificationsService, ReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}