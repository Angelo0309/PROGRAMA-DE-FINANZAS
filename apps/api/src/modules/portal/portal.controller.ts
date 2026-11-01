import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

import {
  JwtAccessGuard,
  PlatformAdminGuard,
} from '../auth/auth.guards.js';
import type { AccessTokenClaims } from '../auth/auth.service.js';
import { PortalService } from './portal.service.js';

const storeSchema = z.object({
  taxId: z.string().min(8).max(20),
  name: z.string().min(2).max(160),
  tradeName: z.string().max(160).optional(),
  currency: z.string().length(3).default('PEN'),
  timeZone: z.string().min(3).max(64).default('America/Lima'),
});
const invitationSchema = z
  .object({
    email: z.string().email().max(254),
    platformRole: z.enum(['PLATFORM_ADMIN', 'USER']),
    storeId: z.string().optional(),
    storeRole: z.enum(['STORE_ADMIN', 'OPERATOR', 'CLIENT']).optional(),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .refine((value) => Boolean(value.storeId) === Boolean(value.storeRole), {
    message: 'storeId y storeRole deben enviarse juntos.',
  });

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      message: 'La solicitud contiene datos inválidos.',
      issues: result.error.issues,
    });
  }
  return result.data;
}

type AuthenticatedRequest = { user: AccessTokenClaims };

@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly service: PortalService) {}

  @Get('stores')
  listStores() {
    return this.service.listStores();
  }

  @Post('stores')
  createStore(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const value = parse(storeSchema, body);
    return this.service.createStore(
      {
        taxId: value.taxId,
        name: value.name,
        currency: value.currency,
        timeZone: value.timeZone,
        ...(value.tradeName === undefined ? {} : { tradeName: value.tradeName }),
      },
      request.user.sub,
    );
  }

  @Post('invitations')
  createInvitation(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const value = parse(invitationSchema, body);
    return this.service.createInvitation(
      {
        email: value.email,
        platformRole: value.platformRole,
        expiresAt: value.expiresAt,
        ...(value.storeId === undefined ? {} : { storeId: value.storeId }),
        ...(value.storeRole === undefined ? {} : { storeRole: value.storeRole }),
      },
      request.user.sub,
    );
  }

  @Get('audit')
  listAudit(@Query('storeId') storeId?: string) {
    return this.service.listAudit(storeId);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('me')
export class MeController {
  constructor(private readonly service: PortalService) {}

  @Get('profile')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.service.getMyProfile(request.user.sub);
  }

  @Get('accounts')
  getAccounts(@Req() request: AuthenticatedRequest) {
    return this.service.getMyAccounts(request.user.sub);
  }

  @Get('statements')
  getStatements(@Req() request: AuthenticatedRequest) {
    return this.service.getMyStatements(request.user.sub);
  }

  @Get('purchases')
  getPurchases(@Req() request: AuthenticatedRequest) {
    return this.service.getMyPurchases(request.user.sub);
  }
}
