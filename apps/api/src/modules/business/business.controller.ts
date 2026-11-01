import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

import type { AccessTokenClaims } from '../auth/auth.service.js';
import {
  JwtAccessGuard,
  StoreAccessGuard,
  StoreRoles,
} from '../auth/auth.guards.js';
import { BusinessService } from './business.service.js';

const decimal = z.string().regex(/^\d+(?:\.\d+)?$/);
const clientSchema = z.object({
  documentType: z.string().min(1).max(20),
  documentNumber: z.string().min(1).max(24),
  fullName: z.string().min(2).max(180),
  phone: z.string().max(32).optional(),
  address: z.string().max(255).optional(),
  userId: z.string().optional(),
});
const productSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(2).max(180),
  description: z.string().max(10_000).optional(),
  unitPrice: decimal,
  currency: z.string().length(3),
  imageUrl: z.string().url().max(2048).optional(),
});
const accountSchema = z.object({
  customerId: z.string().min(1),
  accountNumber: z.string().min(1).max(40),
  currency: z.string().length(3),
  creditLimit: decimal,
});
const conditionSchema = z.object({
  storeId: z.string().min(1),
  compensatoryRateKind: z.enum(['EFFECTIVE_ANNUAL', 'NOMINAL_ANNUAL']),
  compensatoryRate: decimal,
  lateRateKind: z.enum(['EFFECTIVE_ANNUAL', 'NOMINAL_ANNUAL']),
  lateRate: decimal,
  billingDay: z.number().int().min(1).max(30),
  dueDay: z.number().int().min(1).max(30),
  maxInstallments: z.number().int().min(1).max(120),
  graceMonths: z.number().int().min(0).max(24),
  validFrom: z.string().datetime({ offset: true }),
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

function requireStoreId(value: string | undefined): string {
  if (!value) throw new BadRequestException('Se requiere storeId.');
  return value;
}

type AuthenticatedRequest = { user: AccessTokenClaims };

@ApiTags('business')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, StoreAccessGuard)
@StoreRoles('STORE_ADMIN')
@Controller()
export class BusinessController {
  constructor(private readonly service: BusinessService) {}

  @Get('stores/:storeId/clients')
  listClients(@Param('storeId') storeId: string) {
    return this.service.listClients(storeId);
  }

  @Post('stores/:storeId/clients')
  createClient(
    @Param('storeId') storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const value = parse(clientSchema, body);
    return this.service.createClient(
      storeId,
      {
        documentType: value.documentType,
        documentNumber: value.documentNumber,
        fullName: value.fullName,
        ...(value.phone === undefined ? {} : { phone: value.phone }),
        ...(value.address === undefined ? {} : { address: value.address }),
        ...(value.userId === undefined ? {} : { userId: value.userId }),
      },
      request.user.sub,
    );
  }

  @Get('stores/:storeId/products')
  listProducts(@Param('storeId') storeId: string) {
    return this.service.listProducts(storeId);
  }

  @Post('stores/:storeId/products')
  createProduct(
    @Param('storeId') storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const value = parse(productSchema, body);
    return this.service.createProduct(
      storeId,
      {
        sku: value.sku,
        name: value.name,
        unitPrice: value.unitPrice,
        currency: value.currency,
        ...(value.description === undefined
          ? {}
          : { description: value.description }),
        ...(value.imageUrl === undefined ? {} : { imageUrl: value.imageUrl }),
      },
      request.user.sub,
    );
  }

  @Get('stores/:storeId/accounts')
  listAccounts(@Param('storeId') storeId: string) {
    return this.service.listAccounts(storeId);
  }

  @Post('stores/:storeId/accounts')
  createAccount(
    @Param('storeId') storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createAccount(
      storeId,
      parse(accountSchema, body),
      request.user.sub,
    );
  }

  @Post('accounts/:accountId/credit-conditions')
  addCreditCondition(
    @Param('accountId') accountId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const { storeId, ...condition } = parse(conditionSchema, body);
    return this.service.addCreditCondition(
      storeId,
      accountId,
      condition,
      request.user.sub,
    );
  }

  @Get('accounts/:accountId/schedule')
  getSchedule(
    @Param('accountId') accountId: string,
    @Query('storeId') storeId: string | undefined,
  ) {
    return this.service.getSchedule(requireStoreId(storeId), accountId);
  }

  @Get('accounts/:accountId/statements')
  getStatements(
    @Param('accountId') accountId: string,
    @Query('storeId') storeId: string | undefined,
  ) {
    return this.service.getStatements(requireStoreId(storeId), accountId);
  }

  @Get('payments/:paymentId/receipt')
  getReceipt(
    @Param('paymentId') paymentId: string,
    @Query('storeId') storeId: string | undefined,
  ) {
    return this.service.getReceipt(requireStoreId(storeId), paymentId);
  }
}
