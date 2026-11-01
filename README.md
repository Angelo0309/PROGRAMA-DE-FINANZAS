# CrediCuenta

Aplicacion web multi-tienda para controlar creditos comerciales de pequenos negocios. El proyecto implementa compras a fin de mes y en cuotas, cortes, estados de cuenta, pagos completos, mora y auditoria.

## Requisitos

- Node.js 24.15 o superior (recomendado: version de `.nvmrc`).
- npm 11 o superior.
- MariaDB o MySQL disponible en el puerto configurado.
- Una base y un usuario exclusivos para la aplicacion; no usar `root`.

## Estado inicial

La implementacion se realiza por hitos en una rama de funcionalidad. La documentacion de instalacion y los comandos definitivos se ampliaran conforme se incorporen API, base y frontend.

## Comandos del monorepo

```powershell
npm install
npm run test
npm run typecheck
npm run build
```

Copie `.env.example` como `.env` y reemplace todos los secretos antes de iniciar la API.

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

