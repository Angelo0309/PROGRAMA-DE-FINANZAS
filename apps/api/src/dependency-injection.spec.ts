import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { PrismaService } from './database/prisma.service.js';
import { HealthController } from './modules/health/health.controller.js';
import { HealthService } from './modules/health/health.service.js';
import { CreditOperationsService } from './modules/operations/credit-operations.service.js';
import { CutScheduler } from './modules/operations/cut.scheduler.js';

type ExplicitDependency = { index: number; param: unknown };
const dependenciesOf = (target: object) =>
  ((Reflect.getMetadata('self:paramtypes', target) as ExplicitDependency[] | undefined) ?? [])
    .toSorted((left, right) => left.index - right.index);

describe('Nest dependency injection in the tsx development runtime', () => {
  it('declares constructor tokens without relying on emitted type metadata', () => {
    expect(dependenciesOf(CutScheduler)).toEqual([
      { index: 0, param: PrismaService },
      { index: 1, param: CreditOperationsService },
    ]);
    expect(dependenciesOf(HealthService)).toEqual([{ index: 0, param: PrismaService }]);
    expect(dependenciesOf(HealthController)).toEqual([{ index: 0, param: HealthService }]);
  });
});
