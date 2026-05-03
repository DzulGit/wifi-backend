import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET as string, // tambah "as string"
})
  }

  async validate(payload: { sub: string; type: 'user' | 'admin' }) {
    if (payload.type === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      })
      if (!admin || !admin.isActive) throw new UnauthorizedException()
      return { ...admin, type: 'admin' }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })
    if (!user) throw new UnauthorizedException()
    return { ...user, type: 'user' }
  }
}