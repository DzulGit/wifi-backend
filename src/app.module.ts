import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { PackagesModule } from './packages/packages.module'
import { RegistrationsModule } from './registrations/registrations.module'
import { BillingModule } from './billing/billing.module'
import { PaymentsModule } from './payments/payments.module'
import { TicketsModule } from './tickets/tickets.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,      // 1 menit
        limit: 100,       // max 10 request per menit
      },
      {
        name: 'medium',
        ttl: 900000,     // 15 menit
        limit: 300,       // max 30 request per 15 menit
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PackagesModule,
    RegistrationsModule,
    BillingModule,
    PaymentsModule,
    TicketsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Global rate limit semua endpoint
    },
  ],
})
export class AppModule {}