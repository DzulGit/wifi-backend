import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { AuthModule } from '../auth/auth.module'
import { ActivityLogsController } from './activity-logs.controller'
import { ActivityLogBroadcasterService } from './activity-log-broadcaster.service'
import { ActivityLoggingInterceptor } from './activity-logging.interceptor'

@Module({
  imports: [AuthModule],
  controllers: [ActivityLogsController],
  providers: [
    ActivityLogBroadcasterService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLoggingInterceptor,
    },
  ],
  exports: [ActivityLogBroadcasterService],
})
export class ActivityLogsModule {}
