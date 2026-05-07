import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notifications: NotificationsService,
  ) {}

  private excludePassword(user: any) {
  const { password, activationToken, activationExpiry, ...safe } = user
  return safe
}

  // ── Generate 6 digit OTP ──────────────────────────────────
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // ── Send OTP via email ────────────────────────────────────
  async sendOtp(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: { not: 'INACTIVE' } },
    })
    if (!user) throw new NotFoundException('Email tidak terdaftar')

    // Cek apakah OTP sebelumnya masih berlaku (rate limit)
    const recentOtp = await this.prisma.otpCode.findFirst({
      where: {
        email,
        isUsed: false,
        expiresAt: { gt: new Date() },
        createdAt: { gt: new Date(Date.now() - 60 * 1000) }, // 1 menit
      },
    })
    if (recentOtp) {
      throw new BadRequestException('Tunggu 1 menit sebelum kirim OTP lagi')
    }

    const code = this.generateOtp()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 menit

    await this.prisma.otpCode.create({
      data: { userId: user.id, email, code, expiresAt },
    })

    await this.notifications.sendOtpEmail(email, code, user.fullName)

    return { message: 'OTP berhasil dikirim ke email kamu' }
  }

  // ── Verify OTP ────────────────────────────────────────────
  async verifyOtp(email: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) throw new BadRequestException('OTP tidak valid atau sudah expired')

    // Cek maksimal 5 percobaan
    if (otp.attempts >= 5) {
      throw new BadRequestException('Terlalu banyak percobaan, minta OTP baru')
    }

    if (otp.code !== code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      })
      throw new BadRequestException('Kode OTP salah')
    }

    // Tandai OTP sudah dipakai
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { isUsed: true },
    })

    const user = await this.prisma.user.findFirst({ where: { email } })
    if (!user) throw new UnauthorizedException('User tidak ditemukan')
    const token = this.jwt.sign({ sub: user.id, type: 'user' })

    return { token, user: this.excludePassword(user) }
  }

  // ── Login dengan password ─────────────────────────────────
async loginWithPassword(email: string, password: string, ip?: string) {
  const user = await this.prisma.user.findFirst({ where: { email } })

  // Log attempt — catat dulu sebelum validasi
  await this.prisma.loginLog.create({
    data: {
      userId: user?.id ?? null,
      ipAddress: ip ?? 'unknown',
      isSuccess: false, // update nanti kalau berhasil
      failReason: !user ? 'user_not_found' : 'pending',
    }
  }).catch(() => {}) // jangan crash kalau log gagal

  if (!user || !user.password) {
    throw new UnauthorizedException('Email atau password salah')
  }
  if (user.status === 'INACTIVE') {
    throw new UnauthorizedException('Akun tidak aktif')
  }

  // Cek apakah akun terkunci (5 gagal dalam 15 menit)
  const recentFails = await this.prisma.loginLog.count({
    where: {
      userId: user.id,
      isSuccess: false,
      failReason: { not: 'pending' },
      loginAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  })

  if (recentFails >= 5) {
    throw new UnauthorizedException('Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.')
  }

  const isMatch = await bcrypt.compare(password, user.password)

  if (!isMatch) {
    // Update log dengan alasan yang benar
    await this.prisma.loginLog.updateMany({
      where: { userId: user.id, failReason: 'pending' },
      data: { failReason: 'wrong_password' }
    }).catch(() => {})
    throw new UnauthorizedException('Email atau password salah')
  }

  // Login sukses — catat sukses
  await this.prisma.loginLog.create({
    data: {
      userId: user.id,
      ipAddress: ip ?? 'unknown',
      isSuccess: true,
    }
  }).catch(() => {})

  const token = this.jwt.sign({ sub: user.id, type: 'user' })
  return { token, user: this.excludePassword(user) }
}

// ── Login admin ───────────────────────────────────────────
async loginAdmin(email: string, password: string, ip?: string) {
  const admin = await this.prisma.admin.findUnique({ where: { email } })

  if (!admin || !admin.isActive) {
    // Log gagal tanpa expose info admin
    await this.prisma.loginLog.create({
      data: {
        adminId: admin?.id ?? null,
        ipAddress: ip ?? 'unknown',
        isSuccess: false,
        failReason: 'invalid_credentials',
      }
    }).catch(() => {})
    throw new UnauthorizedException('Email atau password salah')
  }

  // Cek lockout admin — lebih ketat: 3 gagal dalam 15 menit
  const recentFails = await this.prisma.loginLog.count({
    where: {
      adminId: admin.id,
      isSuccess: false,
      loginAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  })

  if (recentFails >= 3) {
    throw new UnauthorizedException('Akun admin terkunci sementara. Coba lagi dalam 15 menit.')
  }

  const isMatch = await bcrypt.compare(password, admin.password)

  if (!isMatch) {
    await this.prisma.loginLog.create({
      data: {
        adminId: admin.id,
        ipAddress: ip ?? 'unknown',
        isSuccess: false,
        failReason: 'wrong_password',
      }
    }).catch(() => {})
    throw new UnauthorizedException('Email atau password salah')
  }

  // Sukses
  await this.prisma.loginLog.create({
    data: {
      adminId: admin.id,
      ipAddress: ip ?? 'unknown',
      isSuccess: true,
    }
  }).catch(() => {})

  // Update lastLoginAt
  await this.prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() }
  })

  const token = this.jwt.sign({ sub: admin.id, type: 'admin' })
  const { password: adminPassword, ...safeAdmin } = admin
  return { token, admin: safeAdmin }
}

  // ── Aktivasi akun ─────────────────────────────────────────
  async activateAccount(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        activationToken: token,
        activationExpiry: { gt: new Date() },
      },
    })
    if (!user) throw new BadRequestException('Link aktivasi tidak valid atau sudah expired')

    const hashed = await bcrypt.hash(password, 10)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        status: 'ACTIVE',
        activationToken: null,
        activationExpiry: null,
        activatedAt: new Date(),
      },
    })

    const jwtToken = this.jwt.sign({ sub: user.id, type: 'user' })
    return { token: jwtToken, message: 'Akun berhasil diaktifkan' }
  }
}