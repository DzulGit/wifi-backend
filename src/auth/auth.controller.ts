import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { LoginThrottleGuard } from './guards/login-throttle.guard'

class SendOtpDto { email!: string }
class VerifyOtpDto { email!: string; code!: string }
class LoginDto { email!: string; password!: string }
class ActivateDto { token!: string; password!: string }

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  // Login endpoints tetap dibatasi
  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  login(@Request() req: any, @Body() body: LoginDto) {
    return this.authService.loginWithPassword(body.email, body.password, req.ip)
  }

  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @Post('admin/login')
  loginAdmin(@Request() req: any, @Body() body: LoginDto) {
    return this.authService.loginAdmin(body.email, body.password, req.ip)
  }

  // Semua endpoint lain skip throttle
  @SkipThrottle()
  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body.email)
  }

  @SkipThrottle()
  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.email, body.code)
  }

  @SkipThrottle()
  @Post('activate')
  activate(@Body() body: ActivateDto) {
    return this.authService.activateAccount(body.token, body.password)
  }

  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req: any) {
    return req.user
  }
}