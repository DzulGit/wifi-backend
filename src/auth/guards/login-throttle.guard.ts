import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track per IP + email kombinasi biar lebih spesifik
    const email = req.body?.email ?? 'unknown'
    const ip = req.ip ?? req.connection?.remoteAddress ?? 'unknown'
    return `${ip}-${email}`
  }

  protected errorMessage = 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
}