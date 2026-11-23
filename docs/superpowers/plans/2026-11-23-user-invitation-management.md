# User and Invitation Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar la gestión de usuarios e invitaciones del administrador de plataforma con listados reales, estados seguros y revocación auditada.

**Architecture:** Extender `PortalService` y `PlatformController` sobre los modelos Prisma existentes, sin migraciones. Exponer el contrato en OpenAPI y `ApiClient`, encapsular la interfaz en `components/platform` e integrarla en el espacio de plataforma ya existente.

**Tech Stack:** NestJS, Prisma, Zod, React, TypeScript, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-user-invitation-management-design.md`

## Global Constraints

- Trabajar solo en `feature/user-invitation-management`; `main` no se modifica durante el desarrollo.
- No cambiar Prisma ni crear migraciones.
- No modificar compras, planes, pagos ni cálculos financieros.
- No exponer `passwordHash`, sesiones, `tokenHash` ni tokens de invitaciones ya creadas.
- Proteger todos los endpoints nuevos con `JwtAccessGuard` y `PlatformAdminGuard`.
- Conservar `humanizar_articulo.py` fuera de commits y cambios.

## Review Focus

- Invitación pendiente con fecha pasada: debe mostrarse `EXPIRED` y no permitir revocación.
- Invitación aceptada o revocada: la revocación debe rechazarse sin alterar el registro.
- Usuario con varios accesos: deben mostrarse todas sus tiendas y roles sin duplicar al usuario.
- Usuario sin acceso a tienda: debe seguir apareciendo con su rol de plataforma.
- Usuario que no es administrador de plataforma: no debe acceder a ninguno de los endpoints nuevos.

---

### Task 1: Consultas y revocación en la API

**Files:**
- Modify: `apps/api/src/modules/portal/portal.service.spec.ts`
- Modify: `apps/api/src/modules/portal/portal.service.ts`
- Modify: `apps/api/src/modules/portal/portal.controller.spec.ts`
- Modify: `apps/api/src/modules/portal/portal.controller.ts`

**Interfaces:**
- Produces: `PortalService.listUsers()`, `PortalService.listInvitations(now?: Date)` y `PortalService.revokeInvitation(invitationId: string, actorId: string, now?: Date)`.
- Produces: `GET /platform/users`, `GET /platform/invitations` y `POST /platform/invitations/:invitationId/revoke`.

- [ ] **Step 1: Escribir pruebas fallidas del servicio**

Probar que `listUsers()` devuelve usuarios sin campos secretos y conserva todos sus accesos; que `listInvitations()` convierte una pendiente vencida en `EXPIRED`; y que `revokeInvitation()` solo cambia una pendiente vigente a `REVOKED` y crea `USER_INVITATION_REVOKED` en auditoría.

- [ ] **Step 2: Ejecutar las pruebas del servicio y confirmar el fallo esperado**

Run: `npm test --workspace @credicuenta/api -- portal.service.spec.ts`

Expected: FAIL porque los tres métodos todavía no existen.

- [ ] **Step 3: Implementar los tres métodos mínimos en `PortalService`**

Usar `select` explícito para usuarios e invitaciones. Calcular el estado efectivo sin exponer `tokenHash`; hacer la revocación en transacción con condición `status: PENDING` y `expiresAt > now`.

- [ ] **Step 4: Ejecutar las pruebas del servicio y confirmar que pasan**

Run: `npm test --workspace @credicuenta/api -- portal.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Escribir pruebas fallidas del controlador**

Probar las tres rutas, el actor JWT enviado a la revocación y la presencia de `PlatformAdminGuard` en la clase.

- [ ] **Step 6: Implementar las rutas del controlador y ejecutar sus pruebas**

Run: `npm test --workspace @credicuenta/api -- portal.controller.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit del API**

```bash
git add apps/api/src/modules/portal/portal.service.ts apps/api/src/modules/portal/portal.service.spec.ts apps/api/src/modules/portal/portal.controller.ts apps/api/src/modules/portal/portal.controller.spec.ts
git commit -m "feat(api): expose platform users and invitations"
```

### Task 2: Contrato tipado del frontend

**Files:**
- Modify: `docs/openapi.yaml`
- Modify: `apps/web/src/api/schema.d.ts`
- Modify: `apps/web/src/api/client.ts`

**Interfaces:**
- Produces: `PlatformUserView`, `PlatformInvitationView` y `InvitationStatus`.
- Produces: `ApiClient.listPlatformUsers()`, `ApiClient.listInvitations()` y `ApiClient.revokeInvitation(invitationId: string)`.

- [ ] **Step 1: Añadir a OpenAPI las rutas y esquemas exactos**

Documentar usuarios, accesos, invitaciones y la respuesta de revocación, sin secretos.

- [ ] **Step 2: Actualizar los tipos generados mantenidos por el repositorio**

Alinear `schema.d.ts` y exportar vistas legibles desde `client.ts`.

- [ ] **Step 3: Implementar los tres métodos HTTP del cliente**

Usar las rutas de Task 1 y `POST` para la revocación.

- [ ] **Step 4: Verificar tipos**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit del contrato**

```bash
git add docs/openapi.yaml apps/web/src/api/schema.d.ts apps/web/src/api/client.ts
git commit -m "feat(web): add platform access API contract"
```

### Task 3: Componente de usuarios e invitaciones

**Files:**
- Create: `apps/web/src/components/platform/PlatformAccessManagement.tsx`
- Create: `apps/web/src/components/platform/PlatformAccessManagement.spec.tsx`

**Interfaces:**
- Consumes: `ApiClient`, `PlatformUserView`, `PlatformInvitationView` y la lista de tiendas activas.
- Produces: `PlatformAccessManagement({ api, stores }: { api: ApiClient; stores: PlatformStoreView[] })`.

- [ ] **Step 1: Escribir pruebas fallidas del componente**

Probar usuarios y todos sus roles, etiquetas de los cuatro estados, invitación nueva con enlace de un solo uso, copia cuando el portapapeles existe, alternativa seleccionable cuando no existe y revocación solo para `PENDING`.

- [ ] **Step 2: Ejecutar las pruebas y confirmar que fallan**

Run: `npm test --workspace @credicuenta/web -- PlatformAccessManagement.spec.tsx`

Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar el componente mínimo**

El componente carga usuarios e invitaciones, conserva el formulario actual, actualiza la tabla después de crear y reemplaza localmente el estado después de revocar.

- [ ] **Step 4: Ejecutar las pruebas y confirmar que pasan**

Run: `npm test --workspace @credicuenta/web -- PlatformAccessManagement.spec.tsx`

Expected: PASS.

- [ ] **Step 5: Commit del componente**

```bash
git add apps/web/src/components/platform/PlatformAccessManagement.tsx apps/web/src/components/platform/PlatformAccessManagement.spec.tsx
git commit -m "feat(web): add platform user and invitation management"
```

### Task 4: Integración en el espacio de plataforma

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.spec.tsx`

**Interfaces:**
- Consumes: `PlatformAccessManagement` de Task 3.
- Produces: la sección `Gestión de usuarios` conectada a datos reales.

- [ ] **Step 1: Añadir una prueba fallida de integración**

Entrar como administrador de plataforma, navegar a `Gestión de usuarios` y exigir que se muestren usuario, rol e invitación devueltos por el API simulado.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo esperado**

Run: `npm test --workspace @credicuenta/web -- app.spec.tsx`

Expected: FAIL porque `app.tsx` todavía contiene el formulario anterior.

- [ ] **Step 3: Sustituir el bloque inline por `PlatformAccessManagement`**

Retirar estados y funciones de invitación duplicados de `PlatformWorkspace`; conservar tiendas y auditoría en su ubicación actual.

- [ ] **Step 4: Ejecutar pruebas web**

Run: `npm test --workspace @credicuenta/web`

Expected: PASS.

- [ ] **Step 5: Commit de integración**

```bash
git add apps/web/src/app.tsx apps/web/src/app.spec.tsx
git commit -m "feat(web): integrate platform access management"
```

### Task 5: Verificación completa y entrega

**Files:**
- Modify only if a verification defect requires a scoped fix.

**Interfaces:**
- Produces: una rama lista para Pull Request sin cambios ajenos.

- [ ] **Step 1: Revisar alcance y formato**

Run: `git diff --check main...HEAD`

Expected: sin salida.

- [ ] **Step 2: Ejecutar comprobaciones completas**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

Expected: exit code 0.

- [ ] **Step 3: Ejecutar verificaciones con base local aislada**

Run: `npm run test:integration:local`

Expected: 7/7 o más, todas aprobadas.

Run: `npm run test:deployment:local`

Expected: `live=ok, ready=ok`.

- [ ] **Step 4: Confirmar estado de Git**

Run: `git status --short`

Expected: únicamente `humanizar_articulo.py` sin seguimiento; ningún archivo del desarrollo pendiente.

- [ ] **Step 5: Publicar la rama y abrir Pull Request hacia `main`**

No fusionar hasta que las verificaciones locales y GitHub Actions estén verdes.

