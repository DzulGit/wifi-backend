import { IsEmail, IsString, Length, MinLength, MaxLength } from 'class-validator'

// ── Send OTP ───────────────────────────────────────────────────────────────────
export class SendOtpDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email!: string
}

// ── Verify OTP ─────────────────────────────────────────────────────────────────
export class VerifyOtpDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email!: string

  @IsString()
  @Length(6, 6, { message: 'Kode OTP harus tepat 6 digit' })
  code!: string
}

// ── Login (User & Admin) ───────────────────────────────────────────────────────
export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email!: string

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(100, { message: 'Password terlalu panjang' })
  password!: string
}

// ── Aktivasi Akun ──────────────────────────────────────────────────────────────
export class ActivateDto {
  @IsString()
  @MinLength(10, { message: 'Token tidak valid' })
  token!: string

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(100, { message: 'Password terlalu panjang' })
  password!: string
}

// ── Ganti Password ─────────────────────────────────────────────────────────────
export class ChangePasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password lama minimal 6 karakter' })
  oldPassword!: string

  @IsString()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  @MaxLength(100, { message: 'Password baru terlalu panjang' })
  newPassword!: string
}
