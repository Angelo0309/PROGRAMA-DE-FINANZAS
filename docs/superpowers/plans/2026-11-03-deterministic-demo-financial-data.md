# Deterministic Demo Financial Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una cuenta ficticia separada con compra, corte y obligación vencida para demostrar un único pago completo sin cambiar la fecha del equipo.

**Architecture:** La semilla reutilizará `PrismaService`, `PrismaCreditOperationsRepository` y `CreditOperationsService` para que compra, obligación, corte, saldos y auditoría pasen por las reglas de producción. La cuenta y condición usarán `upsert`; compra y corte usarán claves de idempotencia estables. El pago no se sembrará.

**Tech Stack:** TypeScript 6, Prisma 7, MariaDB/MySQL, Decimal.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-deterministic-demo-financial-data-design.md`

## Global Constraints

- No añadir dependencias, migraciones, endpoints ni pantallas.
- Conservar `CC-000001`; el escenario nuevo usa exclusivamente `CC-DEMO-PAGO`.
- Usar `America/Lima`, compra `2026-09-20T10:00:00-05:00`, producto `PROD-001` y modalidad `END_OF_MONTH`.
- Los importes y fechas calculados proceden del servicio financiero; no insertarlos manualmente.
- No crear, borrar ni reabrir pagos en la semilla.
- No imprimir ni guardar en Git credenciales de Aiven.

## Review Focus

- Segunda ejecución de la semilla: conserva una sola compra y un solo corte; la prueba consulta los conteos después de ejecutar las claves idempotentes otra vez.
- Carrera con el programador automático: el corte usa `auto:<accountId>:<cutAt UTC>` y la misma fecha UTC persistida; la prueba verifica una sola fila de corte.
- Cuenta principal: `CC-000001` permanece separada; la prueba busca el escenario solo por `CC-DEMO-PAGO`.
- Pago ya realizado: la semilla no contiene `createPayment` ni eliminaciones; la revisión de código y la prueba de integración fijan que el pago ocurre solo dentro del test.
- Importe cambiante por mora: la prueba usa la cotización oficial para `2026-11-03T12:00:00-05:00` y pasa exactamente `quote.amount` al pago.

---

### Task 1: Escenario financiero sembrado e integración

**Files:**
- Modify: `apps/api/prisma/seed.ts`
- Modify: `apps/api/test/database.integration.spec.ts`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/TESTING.md`

**Interfaces:**
- Consumes: `new CreditOperationsService(new PrismaCreditOperationsRepository(prisma), randomUUID)`, `createPurchase(CreatePurchaseInput)`, `createCut(CreateCutInput)` y `new BusinessService(prisma).getPaymentQuote(storeId, accountId, paidAt)`.
- Produces: cuenta `CC-DEMO-PAGO`, compra idempotente `demo-payable-purchase-v1`, corte `auto:<accountId>:<cutAt UTC>` y una obligación pendiente vencida.

- [ ] **Step 1: Escribir la prueba de integración fallida**

En `apps/api/test/database.integration.spec.ts`, añadir `loads the deterministic payable demo without prepaying it` después de la prueba de autenticación. Debe:

- buscar `CC-DEMO-PAGO` e incluir compra, crédito, obligación y corte;
- afirmar una compra, una obligación `PENDING` y una fecha de vencimiento anterior a `2026-11-03`;
- afirmar un corte con un detalle para esa obligación y cero pagos antes del test;
- obtener la cotización con `BusinessService.getPaymentQuote(..., '2026-11-03T12:00:00-05:00')` y afirmar `amount > 0`;
- ejecutar `createPurchase` y `createCut` otra vez con las claves del escenario y afirmar que los conteos siguen siendo uno;
- ejecutar `createPayment` con `amount: quote.amount`, comprobar comprobante y repetir la misma clave para afirmar idempotencia.

- [ ] **Step 2: Ejecutar la integración para verificar RED**

Run: `npm run test:integration:local`

Expected: FAIL en la nueva prueba porque `CC-DEMO-PAGO` todavía no existe; las pruebas anteriores continúan pasando.

- [ ] **Step 3: Adaptar la semilla al servicio de producción**

En `apps/api/prisma/seed.ts`:

- sustituir el `PrismaClient` construido localmente por `PrismaService`;
- importar `randomUUID`, `CreditOperationsService` y `PrismaCreditOperationsRepository`;
- crear o reactivar `CC-DEMO-PAGO` con ID fijo `40000000-0000-4000-8000-000000000002`, límite `1000.0000` y el cliente ficticio existente;
- crear condición versión 1 con ID fijo `50000000-0000-4000-8000-000000000002` y los mismos valores de la cuenta principal;
- después de sembrar productos, resolver `PROD-001` e instanciar el servicio;
- llamar `createPurchase` con clave `demo-payable-purchase-v1`, fecha `2026-09-20T10:00:00-05:00`, una unidad y `END_OF_MONTH`;
- normalizar `purchase.assignedCutAt` con `new Date(...).toISOString()` y llamar `createCut` con clave `auto:${accountId}:${cutAt}`;
- no llamar `createPayment` ni borrar datos existentes.

- [ ] **Step 4: Ejecutar la integración para verificar GREEN**

Run: `npm run test:integration:local`

Expected: PASS; la nueva prueba paga exactamente la cotización dentro de la base descartable y las demás pruebas de integración siguen verdes.

- [ ] **Step 5: Documentar el uso de demostración**

En `docs/DEPLOYMENT.md`, indicar que la semilla crea `CC-DEMO-PAGO`, que debe ejecutarse una sola vez en cloud y que el pago cloud se reserva para la exposición. En `docs/TESTING.md`, indicar que la integración local sí consume y descarta el escenario para validar pago y comprobante.

- [ ] **Step 6: Ejecutar la verificación completa**

Run: `npm run lint`

Expected: exit 0.

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm test`

Expected: API y web sin fallos.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/test/database.integration.spec.ts docs/DEPLOYMENT.md docs/TESTING.md docs/superpowers/specs/2026-11-03-deterministic-demo-financial-data-design.md docs/superpowers/plans/2026-11-03-deterministic-demo-financial-data.md
git commit -m "feat(seed): add payable demo scenario"
```

### Task 2: Entrega y carga cloud controlada

**Files:**
- No repository files.

**Interfaces:**
- Consumes: commit verde de Task 1, conexión Aiven de solo lectura y variable temporal `DATABASE_URL` introducida localmente por el usuario.
- Produces: rama remota desplegada y una única carga verificada en la base MySQL de Aiven.

- [ ] **Step 1: Subir la fase verificada**

Run: `git push origin feature/initial-implementation`

Expected: el remoto apunta al commit de Task 1 y Render inicia el despliegue.

- [ ] **Step 2: Verificar servicios sin escribir datos**

Con los conectores, confirmar que el despliegue de Render corresponde al commit nuevo y que el servicio MySQL 8.4 de Aiven está `RUNNING`. No leer ni cambiar credenciales, planes o configuración.

- [ ] **Step 3: Ejecutar la semilla cloud una sola vez con asistencia del usuario**

El conector Aiven oculta la URI por diseño. Pedir al usuario que establezca temporalmente `DATABASE_URL` en su terminal local desde la Service URI de Aiven, sin pegarla en el chat, y ejecutar allí:

```powershell
npm exec --workspace @credicuenta/api -- prisma db seed
```

Expected: el comando finaliza con exit 0. Eliminar la variable temporal al terminar; no modificar ni versionar archivos `.env`.

- [ ] **Step 4: Validar cloud sin completar el pago**

Comprobar desde la web pública: login ficticio, presencia de `CC-DEMO-PAGO`, corte emitido y cotización positiva. No pulsar el botón final de pago.

- [ ] **Step 5: Registrar el resultado operativo**

Reportar commit desplegado, salud de API/web y presencia del escenario. No registrar credenciales, tokens, importes que puedan variar con la fecha ni datos personales.
