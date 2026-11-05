import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module.js';
import { BusinessModule } from './modules/business/business.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { PortalModule } from './modules/portal/portal.module.js';

@Module({
  imports: [
    AuthModule,
    BusinessModule,
    HealthModule,
    OperationsModule,
    PortalModule,
  ],
})
export class AppModule {}

