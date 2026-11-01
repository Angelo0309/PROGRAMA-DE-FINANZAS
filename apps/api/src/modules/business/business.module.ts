import { Module } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessController } from './business.controller.js';
import { BusinessService } from './business.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BusinessController],
  providers: [PrismaService, BusinessService],
})
export class BusinessModule {}
