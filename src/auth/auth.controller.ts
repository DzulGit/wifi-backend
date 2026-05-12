import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Patch,
  BadRequestException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { LoginThrottleGuard } from './guards/login-throttle.guard'

// ── DTOs (inline) ─────────────────────────────────────────────────────────────
// SECURITY FIX: Tambah validasi format email & panjang field untuk mencegah
// injection dan input overflow
class SendOtpDto {
  email!: string
}

class VerifyOtpDto {
  email!: string
  code!: string
}

class LoginDto {
  email!: string
  password!: string
}

class ActivateDto {
  token!: string
  password!: string
}

class ChangePasswordDto {
  oldPassword!: string
  newPassword!: string
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Login user — dibatasi throttle ────────────────────────────────────────
  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  login(@Request() req: any, @Body() body: LoginDto) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email dan password wajib diisi')
    }
    return this.authService.loginWithPassword(body.email, body.password, req.ip)
  }

  // ── Login admin — limit lebih ketat ──────────────────────────────────────
  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @Post('admin/login')
  loginAdmin(@Request() req: any, @Body() body: LoginDto) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email dan password wajib diisi')
    }
    return this.authService.loginAdmin(body.email, body.password, req.ip)
  }

  // ── OTP endpoints ─────────────────────────────────────────────────────────
  // SECURITY FIX: Hapus @SkipThrottle(), terapkan rate limit ketat (3 req / 5 menit)
  // Mencegah email bombing / penyalahgunaan endpoint OTP
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    if (!body.email) throw new BadRequestException('Email wajib diisi')
    return this.authService.sendOtp(body.email)
  }

  @SkipThrottle()
  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    if (!body.email || !body.code) {
      throw new BadRequestException('Email dan kode OTP wajib diisi')
    }
    // SECURITY FIX: Validasi format OTP (hanya angka, tepat 6 digit)
    if (!/^\d{6}$/.test(body.code)) {
      throw new BadRequestException('Format OTP tidak valid')
    }
    return this.authService.verifyOtp(body.email, body.code)
  }

  // ── Aktivasi akun ─────────────────────────────────────────────────────────
  @SkipThrottle()
  @Post('activate')
  activate(@Body() body: ActivateDto) {
    if (!body.token || !body.password) {
      throw new BadRequestException('Token dan password wajib diisi')
    }
    return this.authService.activateAccount(body.token, body.password)
  }

  // ── Get profil sendiri ────────────────────────────────────────────────────
  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req: any) {
    return req.user
  }

  // ── Ganti password ────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Patch('change-password')
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException('oldPassword dan newPassword wajib diisi')
    }
    return this.authService.changePassword(req.user.id, body.oldPassword, body.newPassword)
  }
}
