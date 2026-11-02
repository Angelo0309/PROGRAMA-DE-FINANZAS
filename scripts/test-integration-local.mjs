import { spawnSync } from 'node:child_process';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

dotenv.config({ path: 'apps/api/.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en apps/api/.env.');
}

const sourceUrl = new URL(process.env.DATABASE_URL);
let testDatabase = 'credicuenta_test';
const connectionOptions = {
  host: sourceUrl.hostname,
  port: Number(sourceUrl.port || 3306),
  user: decodeURIComponent(sourceUrl.username),
  password: decodeURIComponent(sourceUrl.password),
  ssl: sourceUrl.searchParams.get('sslaccept') ? {} : undefined,
};
const connection = await mariadb.createConnection(connectionOptions);

try {
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (error) {
    if (error?.code !== 'ER_DBACCESS_DENIED_ERROR') throw error;
    testDatabase = 'test';
    const fallback = await mariadb.createConnection({ ...connectionOptions, database: testDatabase });
    try {
      const tables = await fallback.query('SHOW TABLES');
      const names = tables.map((row) => String(Object.values(row)[0]));
      const isEmpty = names.length === 0;
      const normalizedNames = names.map((name) => name.toLowerCase());
      const isCrediCuenta = normalizedNames.includes('_prisma_migrations') && normalizedNames.includes('tienda');
      if (!isEmpty && !isCrediCuenta) {
        throw new Error('La base `test` contiene tablas ajenas y no se modificará.');
      }
    } finally {
      await fallback.end();
    }
  }
} finally {
  await connection.end();
}

sourceUrl.pathname = `/${testDatabase}`;
const environment = {
  ...process.env,
  DATABASE_URL: sourceUrl.toString(),
  TEST_DATABASE_URL: sourceUrl.toString(),
};
const commands = [
  ['exec', '--workspace', '@credicuenta/api', '--', 'prisma', 'migrate', 'deploy'],
  ['exec', '--workspace', '@credicuenta/api', '--', 'prisma', 'db', 'seed'],
  ['test', '--workspace', '@credicuenta/api', '--', 'database.integration.spec.ts', 'api.e2e.spec.ts'],
];

for (const args of commands) {
  const executable = process.platform === 'win32' ? process.env.ComSpec : 'npm';
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm', ...args]
    : args;
  const result = spawnSync(executable, executableArgs, { env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
