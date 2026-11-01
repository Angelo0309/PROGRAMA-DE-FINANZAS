import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1 AS ready`;
      return { status: 'ready', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        database: 'down',
      });
    }
  }
}
