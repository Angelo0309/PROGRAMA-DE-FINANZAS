import { Module } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [PrismaService, HealthService],
})
export class HealthModule {}
