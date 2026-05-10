import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // SECURITY FIX: Ambil IP dengan urutan prioritas yang benar
    // Jangan gunakan X-Forwarded-For langsung tanpa sanitasi
    // — bisa di-spoof jika tidak ada trusted proxy
    const ip =
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'

    // Normalisasi email ke lowercase untuk konsistensi tracking
    const email = (req.body?.email ?? 'unknown').toLowerCase().trim()

    // Track per kombinasi IP + email untuk spesifisitas lebih tinggi
    return `login:${ip}:${email}`
  }

  protected errorMessage = 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
}
