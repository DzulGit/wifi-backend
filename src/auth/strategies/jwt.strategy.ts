import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    // SECURITY FIX: Pastikan JWT_SECRET terdefinisi saat startup
    // Aplikasi akan crash saat boot jika secret tidak diset — ini disengaja
    // agar tidak berjalan dengan secret kosong/undefined
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is not set. Refusing to start.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      // SECURITY FIX: Tolak token yang tidak punya expiry
      ignoreExpiration: false,
    });
  }

  async validate(payload: {
    sub: string;
    type: 'user' | 'admin';
    exp?: number;
  }) {
    // SECURITY FIX: Validasi tipe payload eksplisit
    if (!payload.sub || !payload.type) {
      throw new UnauthorizedException('Token tidak valid');
    }

    if (payload.type === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });
      if (!admin || !admin.isActive) throw new UnauthorizedException();
      // SECURITY FIX: Strip password hash agar tidak bocor ke req.user / GET /auth/me
      const { password, ...safeAdmin } = admin;
      return { ...safeAdmin, type: 'admin' };
    }

    if (payload.type === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new UnauthorizedException();
      // SECURITY FIX: User yang INACTIVE tidak boleh menggunakan token lama
      if (user.status === 'INACTIVE')
        throw new UnauthorizedException('Akun tidak aktif');
      // SECURITY FIX: Strip semua field sensitif agar tidak bocor ke frontend
      const { password, activationToken, activationExpiry, ...safeUser } = user;
      return { ...safeUser, type: 'user' };
    }

    throw new UnauthorizedException('Tipe token tidak dikenal');
  }
}
