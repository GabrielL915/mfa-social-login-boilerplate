import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IsEmail, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { SsoService } from './sso.service';
import { SsoConnectionsService } from './sso-connections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateConnectionDto {
  @IsString() domain: string;
  @IsString() name: string;
  @IsIn(['oidc', 'saml']) type: 'oidc' | 'saml';
  @IsOptional() @IsObject() oidc?: any;
  @IsOptional() @IsObject() saml?: any;
}

class StartDto {
  @IsEmail() email: string;
}

@Controller('sso')
export class SsoController {
  constructor(private sso: SsoService, private connections: SsoConnectionsService) {}

  /** Front: usuario digita email -> recebe URL do IdP e redireciona. */
  @Post('start')
  async start(@Body() dto: StartDto) {
    return { url: await this.sso.startByEmail(dto.email) };
  }

  /** Alternativa: link direto por conexao (ex: botao "Entrar com Acme"). */
  @Get('start/:connectionId')
  async startById(@Param('connectionId') id: string, @Res() res: Response) {
    res.redirect(await this.sso.startByConnection(this.connections.byId(id)));
  }

  @Get('oidc/callback')
  async oidcCallback(@Query() query: Record<string, string>, @Res() res: Response) {
    res.redirect(await this.sso.oidcCallback(query));
  }

  @Post('saml/callback/:connectionId')
  async samlCallback(@Param('connectionId') id: string, @Body() body: Record<string, string>, @Res() res: Response) {
    res.redirect(await this.sso.samlCallback(id, body));
  }

  @Get('saml/metadata/:connectionId')
  @Header('Content-Type', 'application/xml')
  samlMetadata(@Param('connectionId') id: string) {
    return this.sso.samlMetadata(id);
  }

  // ---- admin (no boilerplate basta estar logado; em prod exigir role admin) ----
  @UseGuards(JwtAuthGuard)
  @Get('connections')
  list() {
    return this.connections.list();
  }

  @UseGuards(JwtAuthGuard)
  @Post('connections')
  create(@Body() dto: CreateConnectionDto) {
    return this.connections.create(dto as any);
  }
}
