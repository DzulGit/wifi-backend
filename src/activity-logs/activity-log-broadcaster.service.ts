import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageEvent } from '@nestjs/common';
import { ApiActivityLog } from './activity-log.types';

@Injectable()
export class ActivityLogBroadcasterService {
  private readonly subject = new Subject<ApiActivityLog>();

  emit(log: ApiActivityLog): void {
    this.subject.next(log);
  }

  /** SSE stream for admin clients */
  stream(): Observable<MessageEvent> {
    return this.subject.pipe(
      map((log) => ({
        data: log,
      })),
    );
  }

  /** In-memory snapshot for initial page load (optional) */
  private readonly recent: ApiActivityLog[] = [];
  private readonly maxRecent = 50;

  pushRecent(log: ApiActivityLog): void {
    this.recent.unshift(log);
    if (this.recent.length > this.maxRecent) {
      this.recent.length = this.maxRecent;
    }
  }

  getRecent(): ApiActivityLog[] {
    return [...this.recent];
  }
}
