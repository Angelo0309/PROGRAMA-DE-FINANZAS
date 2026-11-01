import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../database/prisma.service.js';
import { CreditOperationsService } from './credit-operations.service.js';

@Injectable()
export class CutScheduler {
  private readonly logger = new Logger(CutScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: CreditOperationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async handleCron(): Promise<void> {
    await this.runDueCuts(new Date());
  }

  async runDueCuts(now: Date): Promise<void> {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        assignedCutAt: { lte: now },
        mode: 'END_OF_MONTH',
        credit: {
          obligations: {
            some: { cutDetails: { none: {} }, status: { in: ['PENDING', 'OVERDUE'] } },
          },
        },
      },
      select: { storeId: true, accountId: true, assignedCutAt: true },
      orderBy: { assignedCutAt: 'asc' },
    });
    const dueCuts = new Map(
      purchases.map((purchase) => {
        const cutAt = purchase.assignedCutAt.toISOString();
        return [
          `${purchase.accountId}:${cutAt}`,
          { ...purchase, cutAt },
        ] as const;
      }),
    );

    for (const due of dueCuts.values()) {
      try {
        await this.operations.createCut({
          storeId: due.storeId,
          accountId: due.accountId,
          cutAt: due.cutAt,
          idempotencyKey: `auto:${due.accountId}:${due.cutAt}`,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo generar el corte ${due.accountId} ${due.cutAt}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
