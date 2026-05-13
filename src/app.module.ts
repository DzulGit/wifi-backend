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
import { AdminNotificationsModule } from './admin-notifications/admin-notifications.module'
import { AvatarsModule } from './avatars/avatars.module' 

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'medium',
        ttl: 900000,
        limit: 300,
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
    AdminNotificationsModule,
    AvatarsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}