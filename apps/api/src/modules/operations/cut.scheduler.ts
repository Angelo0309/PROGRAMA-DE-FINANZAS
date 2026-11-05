import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../database/prisma.service.js';
import { CreditOperationsService } from './credit-operations.service.js';
import { billingCutForDueDate } from './billing-cut.js';

@Injectable()
export class CutScheduler {
  private readonly logger = new Logger(CutScheduler.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CreditOperationsService)
    private readonly operations: CreditOperationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async handleCron(): Promise<void> {
    await this.runDueCuts(new Date());
  }

  async runDueCuts(now: Date): Promise<void> {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        credit: {
          obligations: {
            some: { cutDetails: { none: {} }, status: { in: ['PENDING', 'OVERDUE'] } },
          },
        },
      },
      select: {
        storeId: true,
        accountId: true,
        assignedCutAt: true,
        mode: true,
        condition: { select: { billingDay: true } },
        credit: {
          select: {
            obligations: {
              where: {
                cutDetails: { none: {} },
                status: { in: ['PENDING', 'OVERDUE'] },
              },
              select: { dueDate: true },
            },
          },
        },
      },
      orderBy: { assignedCutAt: 'asc' },
    });
    const dueCuts = new Map(
      purchases
        .flatMap((purchase) => {
          const cutDates =
            purchase.mode === 'END_OF_MONTH'
              ? [purchase.assignedCutAt.toISOString()]
              : (purchase.credit?.obligations ?? []).map((obligation) =>
                  new Date(
                    billingCutForDueDate(
                      obligation.dueDate.toISOString().slice(0, 10),
                      purchase.condition.billingDay,
                    ),
                  ).toISOString(),
                );
          return cutDates.map((cutAt) => ({
            storeId: purchase.storeId,
            accountId: purchase.accountId,
            cutAt,
          }));
        })
        .filter((candidate) => new Date(candidate.cutAt) <= now)
        .map((candidate) => [
          `${candidate.accountId}:${candidate.cutAt}`,
          candidate,
        ] as const),
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
