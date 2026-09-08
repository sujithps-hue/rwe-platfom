import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { AuthService } from './auth.service';

class DevLoginDto {
  @IsString()
  tenantId!: string;

  @IsEmail()
  email!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('dev-login')
  login(@Body() dto: DevLoginDto) {
    return this.authService.loginDevOnly(dto.tenantId, dto.email);
  }
}
