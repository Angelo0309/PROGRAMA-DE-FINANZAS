import { Module } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MeController, PlatformController } from './portal.controller.js';
import { PortalService } from './portal.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PlatformController, MeController],
  providers: [PrismaService, PortalService],
})
export class PortalModule {}
