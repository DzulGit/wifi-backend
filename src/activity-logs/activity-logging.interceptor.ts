import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'
import { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { ActivityLogBroadcasterService } from './activity-log-broadcaster.service'
import { ApiActivityLog } from './activity-log.types'

const SKIP_PATH_PREFIXES = ['/uploads', '/admin/logs/stream']
const SKIP_METHODS = new Set(['OPTIONS'])

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  constructor(private readonly broadcaster: ActivityLogBroadcasterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const req = http.getRequest<Request & { user?: Record<string, unknown> }>()
    const res = http.getResponse<Response>()
    const startedAt = Date.now()

    const path = (req.originalUrl ?? req.url ?? '').split('?')[0]

    if (SKIP_METHODS.has(req.method) || this.shouldSkip(path)) {
      return next.handle()
    }

    return next.handle().pipe(
      finalize(() => {
        const log = this.buildLog(req, res, startedAt, path)
        this.broadcaster.pushRecent(log)
        this.broadcaster.emit(log)
      }),
    )
  }

  private shouldSkip(path: string): boolean {
    return SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
  }

  private buildLog(
    req: Request & { user?: Record<string, unknown> },
    res: Response,
    startedAt: number,
    path: string,
  ): ApiActivityLog {
    const user = req.user
    let actorType: ApiActivityLog['actorType'] = 'anonymous'
    let actorId: string | undefined
    let actorLabel = 'Anonymous'

    if (user?.type === 'admin') {
      actorType = 'admin'
      actorId = String(user.id ?? '')
      actorLabel =
        (user.fullName as string) ||
        (user.email as string) ||
        `Admin ${actorId?.slice(0, 8) ?? ''}`
    } else if (user?.type === 'user') {
      actorType = 'user'
      actorId = String(user.id ?? '')
      actorLabel =
        (user.fullName as string) ||
        (user.customerCode as string) ||
        `User ${actorId?.slice(0, 8) ?? ''}`
    }

    const forwarded = req.headers['x-forwarded-for']
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      method: req.method,
      path,
      statusCode: res.statusCode || 0,
      responseTimeMs: Date.now() - startedAt,
      actorType,
      actorId,
      actorLabel,
      ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent'].slice(0, 120)
          : undefined,
    }
  }
}
