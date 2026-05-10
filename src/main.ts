import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // ── CORS ────────────────────────────────────────────────────────────────────
  // FIX: Hapus trailing slash dari origin — menyebabkan mismatch CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL ?? 'https://wifi-frontend-978253671723.asia-southeast2.run.app',
    'https://wifi-frontend-978253671723.asia-southeast2.run.app',
  ]

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // ── SECURITY HEADERS ────────────────────────────────────────────────────────
  app.use((req: any, res: any, next: any) => {
    // ZAP Finding: X-Content-Type-Options Header Missing
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // ZAP Finding: Missing Anti-clickjacking Header
    res.setHeader('X-Frame-Options', 'DENY')

    // Legacy XSS protection (modern browsers use CSP instead)
    res.setHeader('X-XSS-Protection', '1; mode=block')

    // ZAP Finding: Strict-Transport-Security Header Not Set
    // max-age=31536000 = 1 tahun; includeSubDomains = semua subdomain pakai HTTPS
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    )

    // ZAP Finding: Content Security Policy (CSP) Header Not Set
    // Hanya izinkan resource dari domain sendiri + Google APIs yang dipakai
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",        // unsafe-inline diperlukan untuk inline styles library
        "img-src 'self' https://storage.googleapis.com data:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",                  // Mitigasi clickjacking (CSP level)
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    )

    // ZAP Finding: Server Leaks Information via "X-Powered-By"
    res.removeHeader('X-Powered-By')

    // ZAP Finding: Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    // ZAP Finding: Timestamp Disclosure — tidak expose Server header
    res.removeHeader('Server')

    // Permissions Policy — batasi akses ke sensor & API browser yang tidak dipakai
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(self), payment=()',
    )

    next()
  })

  await app.listen(process.env.PORT ?? 3002)
  console.log(`🚀 Server running on port ${process.env.PORT ?? 3002}`)
}

bootstrap()
