import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaService } from '../../database/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CreditOperationsService } from './credit-operations.service.js';
import { OperationsController } from './operations.controller.js';
import { CutScheduler } from './cut.scheduler.js';
import { PrismaCreditOperationsRepository } from './prisma-credit-operations.repository.js';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot()],
  controllers: [OperationsController],
  providers: [
    PrismaService,
    PrismaCreditOperationsRepository,
    CutScheduler,
    {
      provide: CreditOperationsService,
      inject: [PrismaCreditOperationsRepository],
      useFactory: (repository: PrismaCreditOperationsRepository) =>
        new CreditOperationsService(repository, randomUUID),
    },
  ],
})
export class OperationsModule {}
