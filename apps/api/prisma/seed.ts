import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Algorithm, hash } from '@node-rs/argon2';

import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'mysql://credicuenta:change_me@127.0.0.1:3306/CrediCuentaDB';
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

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

await prisma.creditCondition.upsert({
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

for (const product of [
  { sku: 'PROD-001', name: 'Producto Demo', unitPrice: '120.0000' },
  { sku: 'SERV-001', name: 'Servicio Demo', unitPrice: '80.0000' },
]) {
  await prisma.productService.upsert({
    where: { storeId_sku: { storeId: store.id, sku: product.sku } },
    update: { name: product.name, unitPrice: product.unitPrice, active: true },
    create: { ...product, storeId: store.id, currency: 'PEN' },
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
