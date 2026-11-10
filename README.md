# CrediCuenta

**Plataforma multi-tienda para gestionar créditos comerciales de pequeños negocios.**

CrediCuenta reúne en una sola aplicación la administración de clientes, productos, cuentas de crédito, compras, cuotas, estados de cuenta y pagos. El sistema mantiene separados los datos de cada negocio y ofrece portales específicos para la plataforma, el comercio y sus clientes.

> Proyecto académico full stack construido como monorepo con React, NestJS, Prisma y MariaDB.

## Contenido

- [Funcionalidades principales](#funcionalidades-principales)
- [Roles del sistema](#roles-del-sistema)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Inicio rápido](#inicio-rápido)
- [Usuarios de demostración](#usuarios-de-demostración)
- [Verificación](#verificación)
- [Ejecución con Docker](#ejecución-con-docker)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Documentación](#documentación)

## Funcionalidades principales

- Gestión de tiendas, usuarios, invitaciones y permisos por rol.
- Catálogo de productos y servicios con precios decimales e imágenes opcionales.
- Registro de clientes, cuentas corrientes y condiciones de crédito versionadas.
- Compras a fin de mes o mediante cuotas calculadas con el método francés.
- Cronogramas de pago, cortes mensuales y estados de cuenta.
- Cotización y registro de pagos completos con comprobante y detalle de aplicación.
- Portal del cliente con resumen, historial de compras, detalle de productos y planes filtrados por cuenta o compra.
- Intereses compensatorios y moratorios calculados en el backend con aritmética decimal.
- Auditoría, idempotencia y transacciones para las operaciones financieras críticas.

## Roles del sistema

| Rol | Acceso principal |
| --- | --- |
| Administrador de plataforma | Gestiona tiendas, invitaciones y auditoría global. |
| Administrador del negocio | Administra productos, clientes, cuentas, compras, cortes y pagos de su tienda. |
| Operador | Ejecuta las operaciones autorizadas dentro del negocio asignado. |
| Cliente | Consulta sus compras, estados de cuenta, planes de pago y comprobantes. |

## Arquitectura

CrediCuenta es un monolito modular dentro de un monorepo npm:

```text
Navegador
   │
   ▼
React + Vite ── REST/JSON ──► NestJS
                                  │
                                  ▼
                               Prisma
                                  │
                                  ▼
                           MariaDB / MySQL
```

- `apps/web`: interfaz React con navegación y vistas según el rol autenticado.
- `apps/api`: API NestJS organizada por módulos de autenticación, negocio, finanzas, operaciones, portal y salud.
- MariaDB/MySQL es la fuente de verdad. El frontend presenta los importes oficiales devueltos por la API y no recalcula reglas financieras.
- Compras, cortes y pagos usan transacciones serializables, bloqueo de cuenta e idempotencia.

La explicación técnica completa se encuentra en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tecnologías

| Área | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript, Vite y Material UI |
| Backend | NestJS 12, TypeScript y Zod |
| Datos | Prisma 7 y MariaDB/MySQL |
| Finanzas | Decimal.js y Luxon |
| Seguridad | JWT, refresh tokens y Argon2id |
| Pruebas | Vitest, Testing Library, Supertest y Playwright |
| Despliegue | Docker, Render y Aiven |

## Inicio rápido

### Requisitos

- Node.js 24.15 o superior, preferiblemente la versión indicada en `.nvmrc`.
- npm 11 o superior.
- MariaDB o MySQL disponible localmente.
- Una base y un usuario exclusivos para la aplicación; no se recomienda usar `root`.

### 1. Obtener e instalar el proyecto

```powershell
git clone https://github.com/Angelo0309/PROGRAMA-DE-FINANZAS.git
cd "PROGRAMA-DE-FINANZAS"
npm install
```

### 2. Crear la configuración local

```powershell
Copy-Item .env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Edite `apps/api/.env` y configure como mínimo:

- `DATABASE_URL` con la conexión a su MariaDB local.
- `JWT_ACCESS_SECRET` con una cadena segura de al menos 32 caracteres.
- `WEB_ORIGIN=http://localhost:5173`.

Los archivos `.env` son locales y no deben subirse al repositorio.

### 3. Preparar la base de datos

```powershell
npm run prisma:generate --workspace @credicuenta/api
npm exec --workspace @credicuenta/api -- prisma migrate deploy
npm exec --workspace @credicuenta/api -- prisma db seed
```

La semilla utiliza exclusivamente información ficticia para demostración.

### 4. Iniciar la aplicación

Abra dos terminales desde la raíz del proyecto.

**Terminal 1 — API**

```powershell
npm run dev:api
```

**Terminal 2 — aplicación web**

```powershell
npm run dev:web
```

Servicios locales:

- Aplicación web: [http://localhost:5173](http://localhost:5173)
- Documentación Swagger: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- API REST: `http://localhost:3000/api/v1`

## Usuarios de demostración

Después de ejecutar la semilla local, están disponibles estas cuentas:

| Perfil | Usuario |
| --- | --- |
| Administrador de plataforma | `plataforma@credicuenta.test` |
| Administrador del negocio | `negocio@credicuenta.test` |
| Cliente | `cliente@credicuenta.test` |

Contraseña común: `DemoSegura#2026`

Estas credenciales son únicamente para datos ficticios y deben cambiarse fuera de la demostración académica.

## Verificación

Ejecute desde la raíz:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Para probar el recorrido completo contra una base MariaDB local aislada:

```powershell
npm run test:integration:local
```

Esta prueba prepara una base descartable, aplica migraciones, carga datos ficticios y valida autenticación, compras, cortes, pagos, portal del cliente, idempotencia y aislamiento entre tiendas. No debe apuntarse a Aiven ni a otra base con datos que se quieran conservar.

Consulte [docs/TESTING.md](docs/TESTING.md) para conocer todos los escenarios y requisitos de pruebas.

## Ejecución con Docker

Con Docker Desktop instalado:

```powershell
docker compose up --build
```

Después cargue una vez la semilla ficticia:

```powershell
docker compose exec api npm exec --workspace @credicuenta/api -- prisma db seed
```

En este modo, la web queda disponible en [http://localhost:8080](http://localhost:8080) y Swagger en [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

## Estructura del repositorio

```text
PROGRAMA-DE-FINANZAS/
├── apps/
│   ├── api/                 API NestJS, Prisma y lógica financiera
│   └── web/                 Aplicación React y cliente HTTP
├── docs/                    Arquitectura, pruebas, despliegue y OpenAPI
├── scripts/                 Verificación local e integración
├── docker-compose.yml       Entorno local completo con MariaDB
├── package.json             Scripts y workspaces del monorepo
└── README.md
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Pruebas](docs/TESTING.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Contrato OpenAPI](docs/openapi.yaml)
- [Colección de solicitudes HTTP](docs/credicuenta.http)
- [Guía de colaboración del equipo](docs/equipo/GUIA_USO_IA.md)

## Seguridad y datos

- No guarde tokens, contraseñas, archivos `.env` ni conexiones cloud en Git.
- Use una base local o descartable para desarrollo y pruebas.
- No ejecute migraciones ni semillas contra Aiven sin revisar primero el entorno seleccionado.
- Los importes monetarios viajan como cadenas decimales para evitar pérdida de precisión.
- Las reglas financieras y la autorización se aplican en la API, no en el navegador.

## Alcance

CrediCuenta es un proyecto académico orientado a demostrar una implementación full stack de crédito comercial con separación multi-tienda, trazabilidad y reglas financieras reproducibles. La documentación de despliegue en Render y Aiven está disponible en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
