# Arquitectura de CrediCuenta

CrediCuenta es un monolito modular en un monorepo npm. `apps/api` contiene la
API NestJS y `apps/web` la aplicacion React. MariaDB/MySQL es la fuente de
verdad; el frontend nunca calcula montos oficiales.

## Modulos del backend

- `auth`: invitaciones, Argon2id, JWT, rotacion de refresh tokens y roles.
- `finance`: funciones puras 30/360 con Decimal y redondeo HALF_UP.
- `operations`: compras, obligaciones, cortes y pagos completos.
- `business`: clientes, catalogo, cuentas y condiciones versionadas.
- `portal`: plataforma y consultas aisladas del cliente.
- `health`: liveness del proceso y readiness de la base.

Compras, cortes y pagos se ejecutan en transacciones `Serializable`, bloquean
la cuenta con `SELECT ... FOR UPDATE`, reintentan tres conflictos transitorios
y usan claves de idempotencia. Los importes y tasas de la API son cadenas.

## Flujo principal

1. Un administrador invita al usuario y este activa su cuenta.
2. El negocio registra una compra contra una condicion vigente.
3. El motor crea una obligacion de fin de mes o un plan frances.
4. El corte expone las obligaciones elegibles una sola vez.
5. El pago debe cubrir exactamente lo exigible y se aplica en orden: mora,
   interes compensatorio y capital.

El esquema ejecutable esta en `apps/api/prisma/schema.prisma`; la migracion
inicial y la semilla ficticia viven en el mismo directorio.
