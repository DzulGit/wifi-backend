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
import { randomInt } from 'crypto'

// Minimum password strength: min 8 chars, huruf besar, huruf kecil, angka
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

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

  // ── Generate 6-digit OTP menggunakan crypto (bukan Math.random) ──────────
  // SECURITY FIX: Math.random() tidak cryptographically secure
  private generateOtp(): string {
    return String(randomInt(100000, 999999))
  }

  // ── Validasi kekuatan password ────────────────────────────────────────────
  private validatePasswordStrength(password: string): void {
    if (!PASSWORD_REGEX.test(password)) {
      throw new BadRequestException(
        'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka',
      )
    }
  }

  // ── Send OTP via email ────────────────────────────────────────────────────
  async sendOtp(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: { not: 'INACTIVE' } },
    })

    // SECURITY FIX: Jangan reveal apakah email terdaftar atau tidak
    // Response sama apakah email ada atau tidak (mencegah user enumeration)
    if (!user) {
      return { message: 'Jika email terdaftar, OTP akan dikirim dalam beberapa saat' }
    }

    const recentOtp = await this.prisma.otpCode.findFirst({
      where: {
        email,
        isUsed: false,
        expiresAt: { gt: new Date() },
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    })

    if (recentOtp) {
      throw new BadRequestException('Tunggu 1 menit sebelum kirim OTP lagi')
    }

    const code = this.generateOtp()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await this.prisma.otpCode.create({
      data: { userId: user.id, email, code, expiresAt },
    })

    await this.notifications.sendOtpEmail(email, code, user.fullName)

    return { message: 'Jika email terdaftar, OTP akan dikirim dalam beberapa saat' }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async verifyOtp(email: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) throw new BadRequestException('OTP tidak valid atau sudah expired')

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

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { isUsed: true },
    })

    const user = await this.prisma.user.findFirst({ where: { email } })
    if (!user) throw new UnauthorizedException('User tidak ditemukan')

    const token = this.jwt.sign({ sub: user.id, type: 'user' })
    return { token, user: this.excludePassword(user) }
  }

  // ── Login dengan password ─────────────────────────────────────────────────
  async loginWithPassword(email: string, password: string, ip?: string) {
    const user = await this.prisma.user.findFirst({ where: { email } })

    // Log percobaan awal (sebelum validasi)
    await this.prisma.loginLog.create({
      data: {
        userId: user?.id ?? null,
        ipAddress: ip ?? 'unknown',
        isSuccess: false,
        failReason: !user ? 'user_not_found' : 'pending',
      },
    }).catch(() => {})

    if (!user || !user.password) {
      // SECURITY FIX: Lakukan bcrypt dummy supaya response time seragam
      // (mencegah timing attack untuk deteksi email yang terdaftar)
      await bcrypt.compare(password, '$2b$10$dummyhashfordummypurposesonly12345678')
      throw new UnauthorizedException('Email atau password salah')
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Akun tidak aktif')
    }

    const recentFails = await this.prisma.loginLog.count({
      where: {
        userId: user.id,
        isSuccess: false,
        failReason: { not: 'pending' },
        loginAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    })

    if (recentFails >= 5) {
      throw new UnauthorizedException(
        'Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.',
      )
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      await this.prisma.loginLog.updateMany({
        where: { userId: user.id, failReason: 'pending' },
        data: { failReason: 'wrong_password' },
      }).catch(() => {})
      throw new UnauthorizedException('Email atau password salah')
    }

    await this.prisma.loginLog.create({
      data: {
        userId: user.id,
        ipAddress: ip ?? 'unknown',
        isSuccess: true,
      },
    }).catch(() => {})

    const token = this.jwt.sign({ sub: user.id, type: 'user' })
    return { token, user: this.excludePassword(user) }
  }

  // ── Login admin ───────────────────────────────────────────────────────────
  async loginAdmin(email: string, password: string, ip?: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email } })

    if (!admin || !admin.isActive) {
      // SECURITY FIX: Dummy bcrypt untuk timing consistency
      await bcrypt.compare(password, '$2b$10$dummyhashfordummypurposesonly12345678')
      await this.prisma.loginLog.create({
        data: {
          adminId: null,
          ipAddress: ip ?? 'unknown',
          isSuccess: false,
          failReason: 'invalid_credentials',
        },
      }).catch(() => {})
      throw new UnauthorizedException('Email atau password salah')
    }

    const recentFails = await this.prisma.loginLog.count({
      where: {
        adminId: admin.id,
        isSuccess: false,
        loginAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    })

    if (recentFails >= 3) {
      throw new UnauthorizedException(
        'Akun admin terkunci sementara. Coba lagi dalam 15 menit.',
      )
    }

    const isMatch = await bcrypt.compare(password, admin.password)

    if (!isMatch) {
      await this.prisma.loginLog.create({
        data: {
          adminId: admin.id,
          ipAddress: ip ?? 'unknown',
          isSuccess: false,
          failReason: 'wrong_password',
        },
      }).catch(() => {})
      throw new UnauthorizedException('Email atau password salah')
    }

    await this.prisma.loginLog.create({
      data: {
        adminId: admin.id,
        ipAddress: ip ?? 'unknown',
        isSuccess: true,
      },
    }).catch(() => {})

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    const token = this.jwt.sign({ sub: admin.id, type: 'admin' })
    const { password: _adminPassword, ...safeAdmin } = admin
    return { token, admin: safeAdmin }
  }

  // ── Aktivasi akun ─────────────────────────────────────────────────────────
  async activateAccount(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        activationToken: token,
        activationExpiry: { gt: new Date() },
      },
    })

    if (!user) throw new BadRequestException('Link aktivasi tidak valid atau sudah expired')

    // SECURITY FIX: Validasi kekuatan password saat aktivasi
    this.validatePasswordStrength(password)

    const hashed = await bcrypt.hash(password, 12) // FIX: naikkan cost factor dari 10 → 12

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

  // ── Ganti Password ────────────────────────────────────────────────────────
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })

    if (!user) throw new NotFoundException('User tidak ditemukan')
    if (!user.password) throw new BadRequestException('User belum mengatur password')

    const isMatch = await bcrypt.compare(oldPassword, user.password)
    if (!isMatch) {
      throw new BadRequestException('Password lama salah')
    }

    // SECURITY FIX: Validasi kekuatan password baru
    this.validatePasswordStrength(newPassword)

    // SECURITY FIX: Cegah penggunaan password yang sama
    const isSame = await bcrypt.compare(newPassword, user.password)
    if (isSame) {
      throw new BadRequestException('Password baru tidak boleh sama dengan password lama')
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    })

    return { message: 'Password berhasil diubah' }
  }
}
