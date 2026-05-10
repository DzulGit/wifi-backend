import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule) // ← fix generic type

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'https://wifi-frontend-978253671723.asia-southeast2.run.app/',
      'https://wifi-frontend-978253671723.asia-southeast2.run.app/',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })


  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })

  await app.listen(process.env.PORT ?? 3002)
  console.log(`🚀 Server running on port ${process.env.PORT ?? 3002}`)
}
bootstrap()