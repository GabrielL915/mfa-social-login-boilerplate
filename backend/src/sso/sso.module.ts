import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { SsoConnectionsService } from './sso-connections.service';

@Module({
  imports: [UsersModule, AuthModule, JwtModule.register({})],
  controllers: [SsoController],
  providers: [SsoService, SsoConnectionsService],
})
export class SsoModule {}
