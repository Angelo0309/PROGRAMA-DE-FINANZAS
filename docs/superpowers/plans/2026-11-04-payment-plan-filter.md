# Payment Plan Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el administrador filtre el cronograma de una cuenta por compra o vea todos sus planes con una identificación legible.

**Architecture:** Los servicios existentes de cronograma añadirán `purchasedAt` desde la relación de compra, sin ruta nueva ni migración. La web agrupará la respuesta ya cargada por `purchaseId`, derivará etiquetas estables y filtrará localmente la tabla y sus métricas.

**Tech Stack:** NestJS 12, Prisma 7, React 19, TypeScript, Vitest, Testing Library, OpenAPI.

**Spec:** `docs/superpowers/specs/2026-11-04-payment-plan-filter-design.md`

## Global Constraints

- **Todos los planes** reúne únicamente obligaciones de la cuenta seleccionada.
- La etiqueta visible es `Compra DD/MM/AAAA · CÓDIGO`, con los primeros ocho caracteres del `purchaseId` en mayúsculas.
- El UUID completo sigue siendo la identidad funcional del plan.
- No crear rutas, tablas, migraciones ni dependencias.
- No cambiar reglas financieras ni el portal del cliente.
- Importes oficiales continúan como cadenas JSON y la web no los recalcula.

## Review Focus

- Dos compras del mismo día deben conservar opciones distintas mediante su código corto; Task 2 lo prueba con dos `purchaseId` y una misma fecha.
- Cambiar de cuenta debe restablecer **Todos los planes** y no mostrar filas de la cuenta anterior; Task 2 extiende la prueba de respuesta tardía.
- Un plan sin obligaciones pendientes debe mostrar `Sin pendientes`, aunque otros planes de la cuenta sí tengan deuda; Task 2 lo prueba al filtrar el plan anulado.
- Un cronograma vacío no debe mostrar opciones de planes ni una tabla vacía; Task 2 conserva y comprueba el estado vacío.
- La fecha debe proceder de la compra relacionada y mantener formato ISO en ambos portales; Task 1 prueba los dos servicios.

---

### Task 1: Exponer la fecha de compra en el cronograma

**Files:**
- Modify: `apps/api/src/modules/business/business.service.spec.ts`
- Modify: `apps/api/src/modules/business/business.service.ts:364-384`
- Modify: `apps/api/src/modules/portal/portal.service.spec.ts:137-154`
- Modify: `apps/api/src/modules/portal/portal.service.ts:236-258`
- Modify: `docs/openapi.yaml`
- Regenerate: `apps/web/src/api/schema.d.ts`
- Modify: `apps/web/src/api/client.ts:47-60`

**Interfaces:**
- Consumes: relación Prisma `Obligation.credit.purchase.purchasedAt`.
- Produces: cada elemento de `BusinessService.getSchedule(...)` y `PortalService.getMySchedule(...)` incluye `purchasedAt: string` ISO; `ScheduleItemView` expone la misma propiedad.

- [ ] **Step 1: Escribir las pruebas API que fallen**

Añadir `returns purchase metadata in the selected account schedule` a `business.service.spec.ts` con una obligación cuya compra tenga `purchasedAt: new Date('2026-10-20T15:00:00.000Z')`; exigir `purchaseId: 'purchase-1'`, `purchasedAt: '2026-10-20T15:00:00.000Z'` y que `findMany` seleccione la compra relacionada.

Extender `returns the authenticated client payment schedule with official decimal strings` para que el doble incluya la misma relación y la respuesta contenga el mismo `purchasedAt`.

- [ ] **Step 2: Ejecutar las pruebas y comprobar RED**

Run: `npm test --workspace @credicuenta/api -- business.service.spec.ts portal.service.spec.ts`

Expected: FAIL porque `purchasedAt` todavía no existe en la respuesta y la consulta no carga `credit.purchase`.

- [ ] **Step 3: Implementar el metadato mínimo en ambos servicios**

En ambos `findMany`, seleccionar `credit.purchase.purchasedAt`. En cada mapeo, añadir:

```ts
purchasedAt: item.credit.purchase.purchasedAt.toISOString(),
```

No alterar orden, alcance por tienda/cliente ni campos financieros.

- [ ] **Step 4: Ejecutar las pruebas y comprobar GREEN**

Run: `npm test --workspace @credicuenta/api -- business.service.spec.ts portal.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Actualizar el contrato aditivo y regenerar tipos**

Añadir el esquema `ScheduleItem` con `purchaseId` y `purchasedAt`, documentar `GET /accounts/{accountId}/schedule`, y referenciar el esquema desde esa ruta y `GET /me/schedule`. Ejecutar:

Run: `npm run openapi:generate --workspace @credicuenta/web`

Expected: `apps/web/src/api/schema.d.ts` se regenera sin error. Añadir `purchasedAt: string` a `ScheduleItemView` en `client.ts`.

- [ ] **Step 6: Verificar tipos y guardar la tarea**

Run: `npm run typecheck`

Expected: PASS después de actualizar los datos de prueba web que construyan `ScheduleItemView`.

```powershell
git add apps/api/src/modules/business/business.service.ts apps/api/src/modules/business/business.service.spec.ts apps/api/src/modules/portal/portal.service.ts apps/api/src/modules/portal/portal.service.spec.ts docs/openapi.yaml apps/web/src/api/schema.d.ts apps/web/src/api/client.ts apps/web/src/app.spec.tsx
git commit -m "feat(api): expose purchase dates in schedules"
```

### Task 2: Filtrar y etiquetar planes en la vista del negocio

**Files:**
- Modify: `apps/web/src/app.spec.tsx:570-625`
- Modify: `apps/web/src/app.tsx:1430-1490`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `ScheduleItemView.purchaseId` y `ScheduleItemView.purchasedAt` de Task 1.
- Produces: selector `schedule-plan`, etiquetas `Compra DD/MM/AAAA · CÓDIGO`, filas y métricas filtradas por `purchaseId`.

- [ ] **Step 1: Escribir las pruebas web que fallen**

Crear `filters one selected account schedule by purchase plan` con dos compras de la misma fecha y UUID de prueba cuyos primeros ocho caracteres sean `11111111` y `22222222`. Tras elegir `account-1`, exigir:

- opción **Todos los planes** y las opciones `Compra 20/10/2026 · 11111111` y `Compra 20/10/2026 · 22222222`;
- columna **Plan** y filas de ambas compras en modo todos;
- al elegir el UUID que empieza por `11111111`, ausencia de la fila del plan `22222222`, conteo filtrado y próximo vencimiento del plan elegido;
- al elegir el plan anulado, `Sin pendientes`.

Extender `clears an old schedule while a different account is loading` para seleccionar un plan, cambiar a `account-2` y exigir que el filtro vuelva a `all` y no reaparezcan filas tardías.

- [ ] **Step 2: Ejecutar las pruebas y comprobar RED**

Run: `npm test --workspace @credicuenta/web -- app.spec.tsx`

Expected: FAIL porque no existe el selector de plan, la etiqueta ni la columna.

- [ ] **Step 3: Implementar agrupamiento y filtrado local**

En `PaymentPlans`:

- añadir estado `purchaseId` con valor inicial `'all'`;
- restablecerlo a `'all'` al cambiar `accountId`;
- derivar una lista única de planes ordenada por `purchasedAt` descendente y `purchaseId` ascendente;
- construir la etiqueta con `commercialDate(purchasedAt)` y `purchaseId.slice(0, 8).toUpperCase()`;
- derivar `visibleSchedule` para tabla, conteo y próximo vencimiento;
- mostrar el segundo selector únicamente cuando haya al menos un plan;
- mostrar la columna/celda **Plan** solo en modo `'all'`.

- [ ] **Step 4: Ajustar únicamente el estilo necesario**

Reutilizar `schedule-selector` y añadir una distribución responsiva para los dos controles. Mantener una columna en pantallas estrechas y no cambiar el lenguaje visual existente.

- [ ] **Step 5: Ejecutar pruebas y comprobar GREEN**

Run: `npm test --workspace @credicuenta/web -- app.spec.tsx`

Expected: PASS.

- [ ] **Step 6: Verificar la fase completa**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Run: `npm run test:integration:local`

Expected: todos los comandos terminan con código 0; integración 7/7.

- [ ] **Step 7: Guardar la tarea**

```powershell
git add apps/web/src/app.tsx apps/web/src/app.spec.tsx apps/web/src/styles.css
git commit -m "feat(web): filter payment plans by purchase"
```

### Task 3: Revisión final y preparación de la siguiente fase

**Files:**
- Review: `docs/superpowers/specs/2026-11-04-payment-plan-filter-design.md`
- Review: `docs/superpowers/plans/2026-11-04-payment-plan-filter.md`
- Review: `git diff main...HEAD`

**Interfaces:**
- Consumes: tareas 1 y 2 verificadas.
- Produces: rama lista para revisión y una base estable para el ensayo reproducible de exposición.

- [ ] **Step 1: Revisar requisitos contra el diff**

Confirmar: cuenta seleccionada como límite; opción todos; identificador visible; filtro individual; métricas filtradas; sin migración ni regla financiera modificada.

- [ ] **Step 2: Ejecutar comprobación de limpieza**

Run: `git diff --check && git status --short`

Expected: sin errores de diff; únicamente cambios previstos y `humanizar_articulo.py` sin seguimiento.

- [ ] **Step 3: Publicar la rama para revisión**

Run: `git push -u origin codex/payment-plan-filter`

Expected: rama remota creada; no fusionar todavía.
