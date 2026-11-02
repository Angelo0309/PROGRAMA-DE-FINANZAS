import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';

const e2e = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const storeId = '10000000-0000-4000-8000-000000000001';

e2e('CrediCuenta HTTP workflow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes activation, credit, payment and client consultation through the API', async () => {
    const suffix = randomUUID();
    const platformLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'plataforma@credicuenta.test',
        password: 'DemoSegura#2026',
      })
      .expect(201);
    const otherStore = await request(app.getHttpServer())
      .post('/api/v1/platform/stores')
      .set('Authorization', `Bearer ${platformLogin.body.accessToken as string}`)
      .send({
        taxId: `E2E${suffix.replaceAll('-', '').slice(0, 12)}`,
        name: `Tienda aislada ${suffix.slice(0, 8)}`,
        currency: 'PEN',
        timeZone: 'America/Lima',
      })
      .expect(201);

    const invitation = await request(app.getHttpServer())
      .post('/api/v1/platform/invitations')
      .set('Authorization', `Bearer ${platformLogin.body.accessToken as string}`)
      .send({
        email: `cliente-${suffix}@credicuenta.test`,
        platformRole: 'USER',
        storeId,
        storeRole: 'CLIENT',
        expiresAt: '2026-12-31T23:59:59-05:00',
      })
      .expect(201);

    const activation = await request(app.getHttpServer())
      .post('/api/v1/auth/activate')
      .send({
        token: invitation.body.token,
        username: `cliente.${suffix}`,
        displayName: 'Cliente E2E',
        password: 'ClienteE2E#2026',
      })
      .expect(201);
    const clientProfile = await request(app.getHttpServer())
      .get('/api/v1/me/profile')
      .set('Authorization', `Bearer ${activation.body.accessToken as string}`)
      .expect(200);

    const businessLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'negocio@credicuenta.test',
        password: 'DemoSegura#2026',
      })
      .expect(201);
    const authorization = `Bearer ${businessLogin.body.accessToken as string}`;

    const client = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/clients`)
      .set('Authorization', authorization)
      .send({
        documentType: 'DNI',
        documentNumber: suffix.replaceAll('-', '').slice(0, 8),
        fullName: 'Cliente E2E',
        userId: clientProfile.body.id,
      })
      .expect(201);
    const account = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/accounts`)
      .set('Authorization', authorization)
      .send({
        customerId: client.body.id,
        accountNumber: `E2E-${suffix}`,
        currency: 'PEN',
        creditLimit: '1000.00',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/accounts/${account.body.id as string}/credit-conditions`)
      .set('Authorization', authorization)
      .send({
        storeId,
        compensatoryRateKind: 'EFFECTIVE_ANNUAL',
        compensatoryRate: '0.24',
        lateRateKind: 'EFFECTIVE_ANNUAL',
        lateRate: '0.36',
        billingDay: 26,
        dueDay: 5,
        maxInstallments: 12,
        graceMonths: 0,
        validFrom: '2026-01-01T00:00:00-05:00',
      })
      .expect(201);

    const products = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', authorization)
      .expect(200);
    const purchase = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/purchases`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `purchase-${suffix}`)
      .send({
        accountId: account.body.id,
        purchasedAt: '2026-10-20T10:00:00-05:00',
        currency: 'PEN',
        mode: 'END_OF_MONTH',
        items: [{ productId: products.body[0].id, quantity: '1' }],
      })
      .expect(201);
    const obligation = purchase.body.obligations[0];

    const cut = await request(app.getHttpServer())
      .post(`/api/v1/accounts/${account.body.id as string}/cuts`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `cut-${suffix}`)
      .send({ storeId, cutAt: purchase.body.assignedCutAt })
      .expect(201);
    expect(cut.body.obligationIds).toContain(obligation.id);

    const payment = await request(app.getHttpServer())
      .post(`/api/v1/accounts/${account.body.id as string}/payments`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `payment-${suffix}`)
      .send({
        storeId,
        paidAt: `${obligation.dueDate as string}T12:00:00-05:00`,
        currency: 'PEN',
        amount: obligation.amountDue,
      });
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);

    await request(app.getHttpServer())
      .get(`/api/v1/payments/${payment.body.id as string}/receipt`)
      .query({ storeId })
      .set('Authorization', authorization)
      .expect(200)
      .expect(({ body }) => {
        expect(body.receiptNumber).toBeTypeOf('string');
      });
    await request(app.getHttpServer())
      .get('/api/v1/me/accounts')
      .set('Authorization', `Bearer ${activation.body.accessToken as string}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: account.body.id })]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/me/purchases')
      .set('Authorization', `Bearer ${activation.body.accessToken as string}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: purchase.body.id, total: purchase.body.total }),
        ]));
      });
    await request(app.getHttpServer())
      .get('/api/v1/me/statements')
      .set('Authorization', `Bearer ${activation.body.accessToken as string}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: cut.body.id }),
        ]));
      });
    await request(app.getHttpServer())
      .get('/api/v1/me/schedule')
      .set('Authorization', `Bearer ${activation.body.accessToken as string}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: obligation.id, status: 'PAID' }),
        ]));
      });
    await request(app.getHttpServer())
      .get('/api/v1/me/payments')
      .set('Authorization', `Bearer ${activation.body.accessToken as string}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: payment.body.id, receiptNumber: payment.body.receiptNumber }),
        ]));
      });

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${otherStore.body.id as string}/clients`)
      .set('Authorization', authorization)
      .expect(403);
  }, 20_000);
});
