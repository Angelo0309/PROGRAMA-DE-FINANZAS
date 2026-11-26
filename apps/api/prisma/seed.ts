import 'dotenv/config';

import { createHash, randomUUID } from 'node:crypto';
import { Algorithm, hash } from '@node-rs/argon2';
import { Decimal } from 'decimal.js';

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
const operatorUser = await upsertUser({
  id: '20000000-0000-4000-8000-000000000004',
  username: 'operador.demo',
  email: 'operador@credicuenta.test',
  displayName: 'Operador Demo',
});

for (const access of [
  { userId: businessAdmin.id, role: 'STORE_ADMIN' as const },
  { userId: clientUser.id, role: 'CLIENT' as const },
  { userId: operatorUser.id, role: 'OPERATOR' as const },
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

const demoCustomers = await Promise.all([
  {
    id: '30000000-0000-4000-8000-000000000002',
    documentNumber: '70862579',
    fullName: 'Pedro Sanchez Demo',
    phone: '+51 900 000 002',
    address: 'Sin cuenta para probar el estado vacio',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    documentNumber: '70000002',
    fullName: 'Lucia Quispe Demo',
    phone: '+51 900 000 003',
    address: 'Cuenta disponible sin movimientos',
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    documentNumber: '70000003',
    fullName: 'Carlos Mendoza Demo',
    phone: '+51 900 000 004',
    address: 'Compra demostrativa en tres cuotas',
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    documentNumber: '70000004',
    fullName: 'Rosa Torres Demo',
    phone: '+51 900 000 005',
    address: 'Compra demostrativa pagada',
  },
].map((input) => prisma.customer.upsert({
  where: {
    storeId_documentType_documentNumber: {
      storeId: store.id,
      documentType: 'DNI',
      documentNumber: input.documentNumber,
    },
  },
  update: {
    fullName: input.fullName,
    phone: input.phone,
    address: input.address,
    active: true,
  },
  create: {
    ...input,
    storeId: store.id,
    documentType: 'DNI',
  },
})));

const customerByDocument = new Map(
  demoCustomers.map((item) => [item.documentNumber, item]),
);

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

async function upsertDemoAccount(input: {
  id: string;
  customerId: string;
  accountNumber: string;
  creditLimit: string;
}) {
  return prisma.creditAccount.upsert({
    where: {
      storeId_accountNumber: { storeId: store.id, accountNumber: input.accountNumber },
    },
    update: { customerId: input.customerId, active: true, creditLimit: input.creditLimit },
    create: { ...input, storeId: store.id, currency: 'PEN' },
  });
}

const unusedAccount = await upsertDemoAccount({
  id: '40000000-0000-4000-8000-000000000003',
  customerId: customerByDocument.get('70000002')!.id,
  accountNumber: 'CC-000002',
  creditLimit: '1500.0000',
});
const installmentAccount = await upsertDemoAccount({
  id: '40000000-0000-4000-8000-000000000004',
  customerId: customerByDocument.get('70000003')!.id,
  accountNumber: 'CC-000003',
  creditLimit: '2500.0000',
});
const paidAccount = await upsertDemoAccount({
  id: '40000000-0000-4000-8000-000000000005',
  customerId: customerByDocument.get('70000004')!.id,
  accountNumber: 'CC-000004',
  creditLimit: '1200.0000',
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

for (const [index, demoAccount] of [unusedAccount, installmentAccount, paidAccount].entries()) {
  await prisma.creditCondition.upsert({
    where: { accountId_version: { accountId: demoAccount.id, version: 1 } },
    update: {},
    create: {
      id: `50000000-0000-4000-8000-${String(index + 3).padStart(12, '0')}`,
      storeId: store.id,
      accountId: demoAccount.id,
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
}

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
  {
    sku: 'ELEC-001',
    name: 'Tablet Demo',
    unitPrice: '450.0000',
    imageUrl:
      'https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=900&q=80',
  },
  {
    sku: 'HOGAR-001',
    name: 'Licuadora Demo',
    unitPrice: '180.0000',
    imageUrl:
      'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=900&q=80',
  },
  {
    sku: 'SERV-002',
    name: 'Mantenimiento Demo',
    unitPrice: '90.0000',
    imageUrl:
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
  },
  {
    sku: 'PROD-INACTIVO',
    name: 'Producto descontinuado',
    unitPrice: '60.0000',
    imageUrl: null,
    active: false,
  },
]) {
  await prisma.productService.upsert({
    where: { storeId_sku: { storeId: store.id, sku: product.sku } },
    update: {
      name: product.name,
      unitPrice: product.unitPrice,
      imageUrl: product.imageUrl,
      active: product.active ?? true,
    },
    create: { ...product, active: product.active ?? true, storeId: store.id, currency: 'PEN' },
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

const installmentProduct = await prisma.productService.findUniqueOrThrow({
  where: { storeId_sku: { storeId: store.id, sku: 'ELEC-001' } },
});
const installmentPurchase = await operations.createPurchase({
  storeId: store.id,
  accountId: installmentAccount.id,
  operatorUserId: operatorUser.id,
  idempotencyKey: 'demo-installment-purchase-v1',
  purchasedAt: '2026-10-20T11:00:00-05:00',
  currency: 'PEN',
  mode: 'INSTALLMENTS',
  installmentCount: 3,
  items: [{ productId: installmentProduct.id, quantity: '1' }],
});
await operations.createCut({
  storeId: store.id,
  accountId: installmentAccount.id,
  operatorUserId: operatorUser.id,
  idempotencyKey: 'demo-installment-cut-v1',
  cutAt: installmentPurchase.assignedCutAt,
});

const paidProduct = await prisma.productService.findUniqueOrThrow({
  where: { storeId_sku: { storeId: store.id, sku: 'HOGAR-001' } },
});
const paidPurchase = await operations.createPurchase({
  storeId: store.id,
  accountId: paidAccount.id,
  operatorUserId: operatorUser.id,
  idempotencyKey: 'demo-paid-purchase-v1',
  purchasedAt: '2026-08-20T11:00:00-05:00',
  currency: 'PEN',
  mode: 'END_OF_MONTH',
  items: [{ productId: paidProduct.id, quantity: '1' }],
});
await operations.createCut({
  storeId: store.id,
  accountId: paidAccount.id,
  operatorUserId: operatorUser.id,
  idempotencyKey: 'demo-paid-cut-v1',
  cutAt: paidPurchase.assignedCutAt,
});
const paidObligation = paidPurchase.obligations[0]!;
await operations.createPayment({
  storeId: store.id,
  accountId: paidAccount.id,
  operatorUserId: operatorUser.id,
  idempotencyKey: 'demo-paid-payment-v1',
  paidAt: `${paidObligation.dueDate}T12:00:00-05:00`,
  currency: 'PEN',
  amount: new Decimal(paidObligation.amountDue).toFixed(2),
});

for (const invitation of [
  {
    key: 'demo-pending-invitation',
    email: 'pedro@demo.credicuenta.test',
    customerId: customerByDocument.get('70862579')!.id,
    status: 'PENDING' as const,
    expiresAt: new Date('2026-12-31T23:59:59-05:00'),
    acceptedAt: null,
  },
  {
    key: 'demo-accepted-invitation',
    email: 'aceptada@demo.credicuenta.test',
    customerId: customer.id,
    status: 'ACCEPTED' as const,
    expiresAt: new Date('2026-12-31T23:59:59-05:00'),
    acceptedAt: new Date('2026-11-01T10:00:00-05:00'),
  },
  {
    key: 'demo-revoked-invitation',
    email: 'revocada@demo.credicuenta.test',
    customerId: null,
    status: 'REVOKED' as const,
    expiresAt: new Date('2026-12-31T23:59:59-05:00'),
    acceptedAt: null,
  },
  {
    key: 'demo-expired-invitation',
    email: 'vencida@demo.credicuenta.test',
    customerId: null,
    status: 'EXPIRED' as const,
    expiresAt: new Date('2026-10-01T23:59:59-05:00'),
    acceptedAt: null,
  },
]) {
  const tokenHash = createHash('sha256').update(invitation.key).digest('hex');
  await prisma.userInvitation.upsert({
    where: { tokenHash },
    update: {
      email: invitation.email,
      customerId: invitation.customerId,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
    },
    create: {
      storeId: store.id,
      customerId: invitation.customerId,
      issuedById: platformAdmin.id,
      email: invitation.email,
      tokenHash,
      platformRole: 'USER',
      storeRole: 'CLIENT',
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
    },
  });
}

await prisma.auditEvent.create({
  data: {
    userId: platformAdmin.id,
    event: 'DEMO_DATA_SEEDED',
    details: { environment: process.env.NODE_ENV ?? 'development' },
  },
});

await prisma.$disconnect();
