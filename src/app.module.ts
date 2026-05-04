import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
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
    PrismaModule,
    AuthModule,
    UsersModule,
    PackagesModule,
    RegistrationsModule,
    BillingModule,
    PaymentsModule,
    TicketsModule,
  ],
})
export class AppModule {}