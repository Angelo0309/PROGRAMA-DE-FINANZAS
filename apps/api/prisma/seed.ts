import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { Algorithm, hash } from '@node-rs/argon2';

import { PrismaService } from '../src/database/prisma.service.js';
import { CreditOperationsService } from '../src/modules/operations/credit-operations.service.js';
import { PrismaCreditOperationsRepository } from '../src/modules/operations/prisma-credit-operations.repository.js';

const prisma = new PrismaService();

const passwordHash = await hash('DemoSegura#2026', {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

const store = await prisma.store.upsert({
  where: { taxId: '20123456789' },
  update: { active: true },
  create: {
    id: '10000000-0000-4000-8000-000000000001',
    taxId: '20123456789',
    name: 'Comercial Demo CrediCuenta S.A.C.',
    tradeName: 'Bodega La Confianza',
    currency: 'PEN',
  },
});

async function upsertUser(input: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  platformRole?: 'PLATFORM_ADMIN' | 'USER';
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: { passwordHash, active: true },
    create: {
      ...input,
      platformRole: input.platformRole ?? 'USER',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
}

const platformAdmin = await upsertUser({
  id: '20000000-0000-4000-8000-000000000001',
  username: 'admin.plataforma',
  email: 'plataforma@credicuenta.test',
  displayName: 'Administracion de Plataforma',
  platformRole: 'PLATFORM_ADMIN',
});
const businessAdmin = await upsertUser({
  id: '20000000-0000-4000-8000-000000000002',
  username: 'admin.negocio',
  email: 'negocio@credicuenta.test',
  displayName: 'Administracion del Negocio',
});
const clientUser = await upsertUser({
  id: '20000000-0000-4000-8000-000000000003',
  username: 'cliente.demo',
  email: 'cliente@credicuenta.test',
  displayName: 'Maria Cliente Demo',
});

for (const access of [
  { userId: businessAdmin.id, role: 'STORE_ADMIN' as const },
  { userId: clientUser.id, role: 'CLIENT' as const },
]) {
  await prisma.storeAccess.upsert({
    where: { storeId_userId: { storeId: store.id, userId: access.userId } },
    update: { role: access.role, active: true },
    create: { storeId: store.id, userId: access.userId, role: access.role },
  });
}

const customer = await prisma.customer.upsert({
  where: {
    storeId_documentType_documentNumber: {
      storeId: store.id,
      documentType: 'DNI',
      documentNumber: '70000001',
    },
  },
  update: { userId: clientUser.id, active: true },
  create: {
    id: '30000000-0000-4000-8000-000000000001',
    storeId: store.id,
    userId: clientUser.id,
    documentType: 'DNI',
    documentNumber: '70000001',
    fullName: 'Maria Cliente Demo',
    phone: '+51 900 000 001',
    address: 'Direccion ficticia para demostracion',
  },
});

const account = await prisma.creditAccount.upsert({
  where: {
    storeId_accountNumber: { storeId: store.id, accountNumber: 'CC-000001' },
  },
  update: { active: true, creditLimit: '3000.0000' },
  create: {
    id: '40000000-0000-4000-8000-000000000001',
    storeId: store.id,
    customerId: customer.id,
    accountNumber: 'CC-000001',
    currency: 'PEN',
    creditLimit: '3000.0000',
  },
});

const demoPaymentAccount = await prisma.creditAccount.upsert({
  where: {
    storeId_accountNumber: { storeId: store.id, accountNumber: 'CC-DEMO-PAGO' },
  },
  update: { customerId: customer.id, active: true, creditLimit: '1000.0000' },
  create: {
    id: '40000000-0000-4000-8000-000000000002',
    storeId: store.id,
    customerId: customer.id,
    accountNumber: 'CC-DEMO-PAGO',
    currency: 'PEN',
    creditLimit: '1000.0000',
  },
});

const accountCondition = await prisma.creditCondition.upsert({
  where: { accountId_version: { accountId: account.id, version: 1 } },
  update: {},
  create: {
    storeId: store.id,
    accountId: account.id,
    version: 1,
    compensatoryRateKind: 'EFFECTIVE_ANNUAL',
    compensatoryRate: '0.240000000000',
    lateRateKind: 'EFFECTIVE_ANNUAL',
    lateRate: '0.360000000000',
    billingDay: 26,
    dueDay: 5,
    maxInstallments: 12,
    graceMonths: 0,
    validFrom: new Date('2026-01-01T00:00:00-05:00'),
  },
});

await prisma.creditCondition.upsert({
  where: { accountId_version: { accountId: demoPaymentAccount.id, version: 1 } },
  update: {},
  create: {
    id: '50000000-0000-4000-8000-000000000002',
    storeId: store.id,
    accountId: demoPaymentAccount.id,
    version: 1,
    compensatoryRateKind: accountCondition.compensatoryRateKind,
    compensatoryRate: accountCondition.compensatoryRate,
    lateRateKind: accountCondition.lateRateKind,
    lateRate: accountCondition.lateRate,
    billingDay: accountCondition.billingDay,
    dueDay: accountCondition.dueDay,
    maxInstallments: accountCondition.maxInstallments,
    graceMonths: accountCondition.graceMonths,
    validFrom: accountCondition.validFrom,
  },
});

for (const product of [
  {
    sku: 'PROD-001',
    name: 'Producto Demo',
    unitPrice: '120.0000',
    imageUrl:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  },
  {
    sku: 'SERV-001',
    name: 'Servicio Demo',
    unitPrice: '80.0000',
    imageUrl:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80',
  },
]) {
  await prisma.productService.upsert({
    where: { storeId_sku: { storeId: store.id, sku: product.sku } },
    update: {
      name: product.name,
      unitPrice: product.unitPrice,
      imageUrl: product.imageUrl,
      active: true,
    },
    create: { ...product, storeId: store.id, currency: 'PEN' },
  });
}

const demoProduct = await prisma.productService.findUniqueOrThrow({
  where: { storeId_sku: { storeId: store.id, sku: 'PROD-001' } },
});
const operations = new CreditOperationsService(
  new PrismaCreditOperationsRepository(prisma),
  randomUUID,
);
const demoPurchase = await operations.createPurchase({
  storeId: store.id,
  accountId: demoPaymentAccount.id,
  operatorUserId: businessAdmin.id,
  idempotencyKey: 'demo-payable-purchase-v1',
  purchasedAt: '2026-09-20T10:00:00-05:00',
  currency: 'PEN',
  mode: 'END_OF_MONTH',
  items: [{ productId: demoProduct.id, quantity: '1' }],
});
const demoCutAt = new Date(demoPurchase.assignedCutAt).toISOString();
await operations.createCut({
  storeId: store.id,
  accountId: demoPaymentAccount.id,
  idempotencyKey: `auto:${demoPaymentAccount.id}:${demoCutAt}`,
  cutAt: demoCutAt,
});

await prisma.auditEvent.create({
  data: {
    userId: platformAdmin.id,
    event: 'DEMO_DATA_SEEDED',
    details: { environment: process.env.NODE_ENV ?? 'development' },
  },
});

await prisma.$disconnect();
