# Initial Capitalization Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el periodo inicial capitalizado del método francés en los cronogramas del administrador y del cliente.

**Architecture:** Una función pura del motor financiero produce el resumen oficial. Los servicios de negocio y portal lo adjuntan a las filas del cronograma; un componente reutilizable del frontend lo presenta cuando existe un único plan seleccionado.

**Tech Stack:** TypeScript, NestJS, Prisma, Decimal.js, Luxon, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-initial-capitalization-summary-design.md`

## Global Constraints

- Mantener la convención comercial 30/360 y redondeo monetario HALF_UP.
- No agregar dependencias ni migraciones.
- El navegador no reconstruye cálculos financieros.
- Las compras `END_OF_MONTH` no muestran el resumen del método francés.

## Review Focus

- Compra cercana a fin de mes: la fecha base debe conservar el día de pago configurado.
- Fechas almacenadas en UTC: la fecha de compra debe interpretarse en `America/Lima`.
- Más de un plan visible: no debe mostrarse un resumen ambiguo.
- Compra de fin de mes: el resumen debe ser `null`.
- Tasa cero: el interés capitalizado debe mostrarse como `0.00`.

---

### Task 1: Consolidar los datos ficticios locales

**Files:**
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/test/database.integration.spec.ts`

**Interfaces:**
- Produces: escenarios idempotentes de cliente sin cuenta, cuenta vacía, compra en cuotas, compra pagada e invitaciones por estado.

- [x] **Step 1: Escribir la prueba integral y verificar que falla sin los escenarios**
- [x] **Step 2: Implementar el seed idempotente mínimo**
- [x] **Step 3: Ejecutar `npm run test:integration:local` y verificar 8 pruebas aprobadas**
- [ ] **Step 4: Confirmar el diff y crear el commit de datos ficticios**

### Task 2: Producir el resumen oficial en el API

**Files:**
- Modify: `apps/api/src/modules/finance/domain/financial-engine.ts`
- Test: `apps/api/src/modules/finance/domain/financial-engine.spec.ts`
- Modify: `apps/api/src/modules/business/business.service.ts`
- Test: `apps/api/src/modules/business/business.service.spec.ts`
- Modify: `apps/api/src/modules/portal/portal.service.ts`
- Test: `apps/api/src/modules/portal/portal.service.spec.ts`

**Interfaces:**
- Produces: `InitialCapitalizationSummary` con `startDate`, `endDate`, `days`, `originalPrincipal`, `capitalizedInterest` y `capitalizedPrincipal`.
- Produces: propiedad `capitalization` en cada `ScheduleItemView` de una compra en cuotas.

- [ ] **Step 1: Escribir pruebas que reproduzcan el ejemplo 15/09–26/09 y verlas fallar**
- [ ] **Step 2: Implementar `summarizeInitialCapitalization` con 30/360 y HALF_UP**
- [ ] **Step 3: Escribir pruebas de los servicios y verificar que fallan sin el contrato ampliado**
- [ ] **Step 4: Adjuntar el resumen en los cronogramas de negocio y portal**
- [ ] **Step 5: Ejecutar las pruebas específicas y crear el commit del API**

### Task 3: Mostrar el resumen en las tres vistas

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/components/purchases/CapitalizationSummary.tsx`
- Create: `apps/web/src/components/purchases/capitalization.css`
- Modify: `apps/web/src/components/purchases/PurchaseDetail.tsx`
- Modify: `apps/web/src/components/purchases/PurchaseHistory.spec.tsx`
- Modify: `apps/web/src/components/client/ClientPaymentPlans.tsx`
- Modify: `apps/web/src/components/client/ClientPaymentPlans.spec.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.spec.tsx`

**Interfaces:**
- Consumes: `ScheduleItemView.capitalization` producido por Task 2.
- Produces: `CapitalizationSummary` reutilizable y accesible.

- [ ] **Step 1: Escribir pruebas de las tres vistas y verificar que fallan**
- [ ] **Step 2: Ampliar el contrato web y crear el componente visual**
- [ ] **Step 3: Integrar el componente solo cuando hay un plan inequívoco**
- [ ] **Step 4: Ejecutar pruebas web y crear el commit del frontend**

### Task 4: Verificación e integración

**Files:**
- Verify: repository completo.

- [ ] **Step 1: Ejecutar integración MariaDB, lint, tipos, pruebas y compilación**
- [ ] **Step 2: Revisar el diff completo y corregir hallazgos importantes con prueba RED→GREEN**
- [ ] **Step 3: Fusionar localmente en `main`, repetir la verificación y publicar `main`**
