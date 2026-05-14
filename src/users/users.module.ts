import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [NotificationsModule, AdminNotificationsModule],
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule {}
