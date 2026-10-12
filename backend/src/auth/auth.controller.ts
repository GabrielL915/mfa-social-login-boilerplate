import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ProviderConfiguredGuard } from './guards/provider-configured.guard';
import { CompleteProfileDto, LinkAccountDto, LoginDto, MfaCodeDto, MfaLoginDto, RegisterDto } from './dto/auth.dto';
import { maskCpf } from '../users/cpf';
import { User } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // ---------- local ----------
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.cpf, dto.email, dto.password, dto.name);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.cpf, dto.password);
  }

  // ---------- completar cadastro (social/SSO sem CPF) ----------
  @Post('profile/complete')
  completeProfile(@Body() dto: CompleteProfileDto) {
    return this.auth.completeProfile(dto.profileToken, dto.cpf);
  }

  @Post('profile/link')
  linkAccount(@Body() dto: LinkAccountDto) {
    return this.auth.linkAccount(dto.profileToken, dto.cpf, dto.password);
  }

  // ---------- MFA ----------
  @Post('mfa/verify') // 2o passo do login (senha ou social)
  mfaVerify(@Body() dto: MfaLoginDto) {
    return this.auth.verifyMfaLogin(dto.mfaToken, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  mfaSetup(@Req() req: Request) {
    return this.auth.mfaSetup((req.user as User).id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  mfaEnable(@Req() req: Request, @Body() dto: MfaCodeDto) {
    return this.auth.mfaEnable((req.user as User).id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  mfaDisable(@Req() req: Request, @Body() dto: MfaCodeDto) {
    return this.auth.mfaDisable((req.user as User).id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const { passwordHash, mfaSecret, mfaRecoveryCodes, cpf, ...safe } = req.user as User;
    return { ...safe, cpf: maskCpf(cpf), profileComplete: !!cpf };
  }

  // ---------- social: Google ----------
  @Get('google')
  @UseGuards(ProviderConfiguredGuard, AuthGuard('google'))
  google() {}

  @Get('google/callback')
  @UseGuards(ProviderConfiguredGuard, AuthGuard('google'))
  googleCb(@Req() req: Request, @Res() res: Response) {
    return this.socialFinish(req, res);
  }

  // ---------- social: Microsoft ----------
  @Get('microsoft')
  @UseGuards(ProviderConfiguredGuard, AuthGuard('microsoft'))
  microsoft() {}

  @Get('microsoft/callback')
  @UseGuards(ProviderConfiguredGuard, AuthGuard('microsoft'))
  microsoftCb(@Req() req: Request, @Res() res: Response) {
    return this.socialFinish(req, res);
  }

  // ---------- social: Apple (callback e POST form_post) ----------
  @Get('apple')
  @UseGuards(ProviderConfiguredGuard, AuthGuard('apple'))
  apple() {}

  @Post('apple/callback')
  @UseGuards(ProviderConfiguredGuard, AuthGuard('apple'))
  appleCb(@Req() req: Request, @Res() res: Response) {
    return this.socialFinish(req, res);
  }

  private async socialFinish(req: Request, res: Response) {
    const result = await this.auth.issueAfterPrimaryAuth(req.user as User);
    return res.redirect(this.auth.buildSocialRedirect(result));
  }
}
