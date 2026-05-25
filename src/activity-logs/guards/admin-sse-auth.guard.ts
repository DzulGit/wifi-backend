import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * JWT guard for SSE: EventSource cannot set Authorization header,
 * so token may be passed via ?token= or Authorization header.
 */
@Injectable()
export class AdminSseAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest();
  }

  canActivate(context: ExecutionContext) {
    const req = this.getRequest(context);
    const queryToken = req.query?.token;

    if (
      typeof queryToken === 'string' &&
      queryToken.length > 0 &&
      !req.headers.authorization
    ) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Token tidak valid');
    }

    const admin = user as { type?: string };
    if (admin.type !== 'admin') {
      throw new ForbiddenException(
        'Hanya admin yang dapat mengakses log stream',
      );
    }

    return user;
  }
}
