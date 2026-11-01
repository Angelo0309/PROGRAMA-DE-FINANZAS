import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Decimal } from 'decimal.js';
import { z, type ZodType } from 'zod';

import type { AccessTokenClaims } from '../auth/auth.service.js';
import {
  JwtAccessGuard,
  StoreAccessGuard,
  StoreRoles,
} from '../auth/auth.guards.js';
import { CreditOperationsService } from './credit-operations.service.js';

const decimalString = z.string().regex(/^\d+(?:\.\d+)?$/);
const purchaseSchema = z.object({
  accountId: z.string().min(1),
  purchasedAt: z.string().datetime({ offset: true }),
  currency: z.string().length(3),
  mode: z.enum(['END_OF_MONTH', 'INSTALLMENTS']),
  installmentCount: z.number().int().positive().optional(),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: decimalString }))
    .min(1),
});
const cutSchema = z.object({
  storeId: z.string().min(1),
  cutAt: z.string().datetime({ offset: true }),
});
const paymentSchema = z.object({
  storeId: z.string().min(1),
  paidAt: z.string().datetime({ offset: true }),
  currency: z.string().length(3),
  amount: decimalString,
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

function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.length < 8 || value.length > 100) {
    throw new BadRequestException('Se requiere una clave de idempotencia válida.');
  }
  return value;
}

type AuthenticatedRequest = { user: AccessTokenClaims };

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, StoreAccessGuard)
@StoreRoles('STORE_ADMIN', 'OPERATOR')
@Controller()
export class OperationsController {
  constructor(
    @Inject(CreditOperationsService)
    private readonly service: CreditOperationsService,
  ) {}

  @Post('stores/:storeId/purchases')
  createPurchase(
    @Param('storeId') storeId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const parsed = parse(purchaseSchema, body);
    return this.service
      .createPurchase({
        accountId: parsed.accountId,
        purchasedAt: parsed.purchasedAt,
        currency: parsed.currency,
        mode: parsed.mode,
        items: parsed.items,
        ...(parsed.installmentCount === undefined
          ? {}
          : { installmentCount: parsed.installmentCount }),
        storeId,
        operatorUserId: request.user.sub,
        idempotencyKey: requireIdempotencyKey(idempotencyKey),
      })
      .then((purchase) => ({
        ...purchase,
        obligations: purchase.obligations.map((obligation) => ({
          ...obligation,
          amountDue: new Decimal(obligation.amountDue)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toFixed(2),
        })),
      }));
  }

  @Post('accounts/:accountId/cuts')
  createCut(
    @Param('accountId') accountId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createCut({
      ...parse(cutSchema, body),
      accountId,
      operatorUserId: request.user.sub,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  @Post('accounts/:accountId/payments')
  createPayment(
    @Param('accountId') accountId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createPayment({
      ...parse(paymentSchema, body),
      accountId,
      operatorUserId: request.user.sub,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }
}
