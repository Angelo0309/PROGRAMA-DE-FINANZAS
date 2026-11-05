import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient } from '../generated/prisma/client.js';

const localDatabaseUrl =
  'mysql://credicuenta:change_me@127.0.0.1:3306/CrediCuentaDB';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaMariaDb(
        process.env.DATABASE_URL ?? localDatabaseUrl,
      ),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
