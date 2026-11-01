# CrediCuenta

Aplicacion web multi-tienda para controlar creditos comerciales de pequenos negocios. El proyecto implementa compras a fin de mes y en cuotas, cortes, estados de cuenta, pagos completos, mora y auditoria.

## Requisitos

- Node.js 24.15 o superior (recomendado: version de `.nvmrc`).
- npm 11 o superior.
- MariaDB o MySQL disponible en el puerto configurado.
- Una base y un usuario exclusivos para la aplicacion; no usar `root`.

## Estado

La version `1.0.0-entrega-final` contiene backend, frontend, migraciones,
semillas ficticias, pruebas y configuracion de despliegue academico.

## Comandos del monorepo

```powershell
npm install
npm run test
npm run typecheck
npm run build
```

Copie `.env.example` como `apps/api/.env` y reemplace los secretos antes de
iniciar la API. Para el frontend, copie `apps/web/.env.example` como
`apps/web/.env`.

## Base de datos local

Configure `DATABASE_URL` en `.env` y ejecute:

```powershell
npm run prisma:generate --workspace @credicuenta/api
npm exec --workspace @credicuenta/api -- prisma migrate deploy
npm exec --workspace @credicuenta/api -- prisma db seed
```

La semilla usa exclusivamente datos ficticios. Los usuarios
`plataforma@credicuenta.test`, `negocio@credicuenta.test` y
`cliente@credicuenta.test` comparten la clave local `DemoSegura#2026`. Debe
cambiarse fuera de la demostracion academica.

## Probar el backend y obtener tokens

1. Inicie MariaDB y ejecute las migraciones y la semilla indicadas arriba.
2. En una terminal ejecute `npm run dev:api`.
3. Abra [docs/credicuenta.http](docs/credicuenta.http) en VS Code con la
   extension REST Client y ejecute primero `login`.
4. La respuesta contiene `accessToken` y `refreshToken`. Copie el
   `accessToken` en la variable del mismo archivo y ejecute las consultas
   protegidas. Swagger esta en `http://localhost:3000/api/docs`.

Tambien puede obtenerlos desde PowerShell:

```powershell
$body = @{ identifier = 'negocio@credicuenta.test'; password = 'DemoSegura#2026' } | ConvertTo-Json
$tokens = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/auth/login' -ContentType 'application/json' -Body $body
$tokens.accessToken
$tokens.refreshToken
```

El frontend obtiene y guarda estos tokens automaticamente al iniciar sesion;
no deben escribirse permanentemente en el codigo. Ejecute `npm run dev:web` y
abra `http://localhost:5173`.

La alternativa mas corta es `docker compose up --build`, seguida de la
semilla documentada en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

