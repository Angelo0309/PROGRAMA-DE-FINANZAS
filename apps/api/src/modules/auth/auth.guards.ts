import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  type CustomDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import {
  AuthService,
  type AccessTokenClaims,
} from './auth.service.js';
import { resolveAccessTokenSecret } from './auth.config.js';
import type { StoreRole } from './ports/auth.repository.js';

export const STORE_ROLES = 'credicuenta:store-roles';
export const StoreRoles = (...roles: StoreRole[]): CustomDecorator<string> =>
  SetMetadata(STORE_ROLES, roles);

type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user?: AccessTokenClaims;
};

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    const [scheme, token] = value?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Se requiere un token de acceso.');
    }
    try {
      request.user = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        secret: resolveAccessTokenSecret(),
      });
      return true;
    } catch {
      throw new UnauthorizedException('El token de acceso no es válido.');
    }
  }
}

@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Usuario no autenticado.');
    const storeId =
      request.params.storeId ??
      (typeof request.body?.storeId === 'string' ? request.body.storeId : undefined) ??
      (typeof request.query?.storeId === 'string' ? request.query.storeId : undefined);
    if (!storeId) throw new UnauthorizedException('No se identificó la tienda.');
    const roles =
      this.reflector.getAllAndOverride<StoreRole[]>(STORE_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? ['STORE_ADMIN', 'OPERATOR'];
    await this.authService.assertStoreAccess(request.user.sub, storeId, roles);
    return true;
  }
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Usuario no autenticado.');
    if (request.user.platformRole !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException('Se requiere el rol de plataforma.');
    }
    return true;
  }
}
