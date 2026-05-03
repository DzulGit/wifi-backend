import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { PackagesModule } from './packages/packages.module'
import { RegistrationsModule } from './registrations/registrations.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PackagesModule,
    RegistrationsModule,
  ],
})
export class AppModule {}