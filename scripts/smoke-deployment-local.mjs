import { spawn } from 'node:child_process';
import { once } from 'node:events';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

dotenv.config({ path: 'apps/api/.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en apps/api/.env.');
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const candidates = process.env.TEST_DATABASE_URL
  ? [new URL(process.env.TEST_DATABASE_URL)]
  : ['credicuenta_test', 'test'].map((name) => {
      const candidate = new URL(databaseUrl);
      candidate.pathname = `/${name}`;
      return candidate;
    });
let selectedDatabaseUrl;
for (const candidate of candidates) {
  try {
    const connection = await mariadb.createConnection({
      host: candidate.hostname,
      port: Number(candidate.port || 3306),
      user: decodeURIComponent(candidate.username),
      password: decodeURIComponent(candidate.password),
      database: candidate.pathname.slice(1),
      ssl: candidate.searchParams.get('sslaccept') ? {} : undefined,
    });
    try {
      const tables = await connection.query('SHOW TABLES');
      const names = tables.map((row) => String(Object.values(row)[0]).toLowerCase());
      if (names.includes('_prisma_migrations') && names.includes('tienda')) {
        selectedDatabaseUrl = candidate;
        break;
      }
    } finally {
      await connection.end();
    }
  } catch {
    // La siguiente base candidata puede ser la preparada por el test integral.
  }
}
if (!selectedDatabaseUrl) throw new Error('Ejecute primero `npm run test:integration:local`.');

const port = 3100;
const api = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    DATABASE_URL: selectedDatabaseUrl.toString(),
    JWT_ACCESS_SECRET: 'local-smoke-secret-with-at-least-32-characters',
    WEB_ORIGIN: 'http://127.0.0.1:4173',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let diagnostic = '';
api.stdout.on('data', (chunk) => { diagnostic = `${diagnostic}${chunk}`.slice(-4000); });
api.stderr.on('data', (chunk) => { diagnostic = `${diagnostic}${chunk}`.slice(-4000); });

async function waitForReady() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`La API terminó antes del health check.\n${diagnostic}`);
    try {
      const live = await fetch(`http://127.0.0.1:${port}/api/v1/health/live`);
      const ready = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`);
      if (live.ok && ready.ok) return;
    } catch {
      // El proceso todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`La API no quedó lista dentro de 20 segundos.\n${diagnostic}`);
}

try {
  await waitForReady();
  console.log('Smoke de despliegue: live=ok, ready=ok');
} finally {
  if (api.exitCode === null) {
    api.kill();
    await Promise.race([
      once(api, 'exit'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('La API temporal no se cerró en 5 segundos.')), 5_000)),
    ]);
  }
}
