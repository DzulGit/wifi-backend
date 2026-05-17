import { Controller, Get, Sse, UseGuards } from '@nestjs/common'
import { Observable } from 'rxjs'
import { MessageEvent } from '@nestjs/common'
import { ActivityLogBroadcasterService } from './activity-log-broadcaster.service'
import { AdminSseAuthGuard } from './guards/admin-sse-auth.guard'
import { ApiActivityLog } from './activity-log.types'

@Controller('admin/logs')
export class ActivityLogsController {
  constructor(private readonly broadcaster: ActivityLogBroadcasterService) {}

  /**
   * GET /admin/logs/recent — snapshot ringan saat halaman dibuka
   */
  @Get('recent')
  @UseGuards(AdminSseAuthGuard)
  getRecent(): { logs: ApiActivityLog[] } {
    return { logs: this.broadcaster.getRecent() }
  }

  /**
   * GET /admin/logs/stream — Server-Sent Events (admin only)
   */
  @Sse('stream')
  @UseGuards(AdminSseAuthGuard)
  stream(): Observable<MessageEvent> {
    return this.broadcaster.stream()
  }
}
