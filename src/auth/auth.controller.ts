import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'

class SendOtpDto { email!: string }
class VerifyOtpDto { email!: string; code!: string }
class LoginDto { email!: string; password!: string }
class ActivateDto { token!: string; password!: string }

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body.email)
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.email, body.code)
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.loginWithPassword(body.email, body.password)
  }

  @Post('admin/login')
  loginAdmin(@Body() body: LoginDto) {
    return this.authService.loginAdmin(body.email, body.password)
  }

  @Post('activate')
  activate(@Body() body: ActivateDto) {
    return this.authService.activateAccount(body.token, body.password)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req) {
    return req.user
  }
}