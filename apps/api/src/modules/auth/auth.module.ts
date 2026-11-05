import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service.js';
import { resolveAccessTokenSecret } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import {
  JwtAccessGuard,
  PlatformAdminGuard,
  StoreAccessGuard,
} from './auth.guards.js';
import { AuthService, type AuthServiceOptions } from './auth.service.js';
import { PrismaAuthRepository } from './prisma-auth.repository.js';

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function loadAuthOptions(): AuthServiceOptions {
  return {
    accessTokenSecret: resolveAccessTokenSecret(),
    accessTokenTtlSeconds: readPositiveInteger(
      process.env.ACCESS_TOKEN_TTL_SECONDS,
      900,
    ),
    refreshTokenTtlSeconds:
      readPositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 7) * 86_400,
  };
}

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PrismaService,
    PrismaAuthRepository,
    JwtAccessGuard,
    StoreAccessGuard,
    PlatformAdminGuard,
    {
      provide: AuthService,
      inject: [PrismaAuthRepository, JwtService],
      useFactory: (
        repository: PrismaAuthRepository,
        jwtService: JwtService,
      ) => new AuthService(repository, jwtService, loadAuthOptions()),
    },
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtAccessGuard,
    StoreAccessGuard,
    PlatformAdminGuard,
  ],
})
export class AuthModule {}
