import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginThrottleGuard } from './guards/login-throttle.guard';
import {
  SendOtpDto,
  VerifyOtpDto,
  LoginDto,
  ActivateDto,
  ChangePasswordDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Login user — dibatasi throttle ────────────────────────────────────────
  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  login(@Request() req: any, @Body() body: LoginDto) {
    return this.authService.loginWithPassword(
      body.email,
      body.password,
      req.ip,
    );
  }

  // ── Login admin — limit lebih ketat ──────────────────────────────────────
  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @Post('admin/login')
  loginAdmin(@Request() req: any, @Body() body: LoginDto) {
    return this.authService.loginAdmin(body.email, body.password, req.ip);
  }

  // ── OTP endpoints ─────────────────────────────────────────────────────────
  // SECURITY FIX: Rate limit ketat (3 req / 5 menit) — mencegah email bombing
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    // Validasi format email ditangani oleh ValidationPipe + @IsEmail() di DTO
    return this.authService.sendOtp(body.email);
  }

  @SkipThrottle()
  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    // Validasi email & format OTP 6-digit ditangani oleh ValidationPipe + @Length(6,6) di DTO
    return this.authService.verifyOtp(body.email, body.code);
  }

  // ── Aktivasi akun ─────────────────────────────────────────────────────────
  @SkipThrottle()
  @Post('activate')
  activate(@Body() body: ActivateDto) {
    return this.authService.activateAccount(body.token, body.password);
  }

  // ── Get profil sendiri ────────────────────────────────────────────────────
  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
  }

  // ── Ganti password ────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Patch('change-password')
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.id,
      body.oldPassword,
      body.newPassword,
    );
  }
}
