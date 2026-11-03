# Invitation Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el administrador de plataforma entregue un enlace de un solo uso con el que el futuro administrador del negocio activa su cuenta y entra al portal asignado.

**Architecture:** La aplicación distinguirá únicamente `/activar` mediante `window.location.pathname`, sin añadir un router. El cliente HTTP reutilizará `POST /auth/activate`; el componente raíz guardará los tokens devueltos y cargará el perfil con el enrutamiento por rol existente. Plataforma formará un enlace con `window.location.origin` y ofrecerá copiado mediante la API nativa del navegador.

**Tech Stack:** React 19, TypeScript, Zod, Testing Library, Vitest, CSS existente.

**Spec:** `docs/superpowers/specs/2026-11-03-invitation-activation-design.md`

## Global Constraints

- No añadir dependencias ni un router.
- No cambiar el contrato del backend.
- El token solo procede de `?token=` y nunca se registra ni se persiste como dato de aplicación.
- Conservar validación, accesibilidad, manejo de errores y bloqueo de envíos repetidos.
- Reutilizar la estructura visual del acceso actual.

## Review Focus

- URL sin token: el formulario queda bloqueado y explica que debe solicitarse una invitación nueva; Task 1 lo prueba.
- Contraseñas distintas o menores de 12 caracteres: se rechazan localmente sin llamar a la API; Task 1 lo prueba.
- Invitación expirada, inválida o usada: se muestra el mensaje de la API y no se guardan tokens; Task 1 lo prueba.
- Doble envío mientras la activación está pendiente: se realiza una sola llamada; Task 1 lo prueba.
- Portapapeles no disponible: el enlace permanece visible y seleccionable; Task 2 lo prueba.

---

### Task 1: Activación pública y entrada por rol

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/app.tsx`
- Test: `apps/web/src/app.spec.tsx`

**Interfaces:**
- Consumes: `POST /auth/activate` con `{ token, username, displayName, password }` y respuesta `TokenPair`.
- Produces: `ApiClient.activate(input): Promise<TokenPair>` y la entrada pública `/activar?token=...` que llama `onAuthenticated(profile)` después de guardar la sesión.

- [ ] **Step 1: Añadir pruebas fallidas de la entrada pública**

En `apps/web/src/app.spec.tsx`, restablecer la URL a `/` en `beforeEach`, añadir `activate` al doble de `ApiClient` y pruebas con estos comportamientos:

- `shows guidance when an activation link has no token`: en `/activar`, muestra orientación y no permite activar.
- `validates activation passwords before calling the API`: con token válido, contraseña menor de 12 o confirmación distinta no llama `api.activate`.
- `activates an invitation once and routes the assigned business administrator`: aun con una sesión local anterior, envía exactamente `{ token, username, displayName, password }`, reemplaza ambos tokens, consulta el perfil y muestra `Mesa de crédito`.
- `keeps activation available after an API rejection without storing a session`: presenta el mensaje de la API, limpia las contraseñas y `localStorage` no contiene tokens.
- `does not submit an activation twice while the first request is pending`: dos envíos inmediatos producen una llamada.

- [ ] **Step 2: Ejecutar las pruebas para verificar RED**

Run: `npm run test --workspace @credicuenta/web -- app.spec.tsx`

Expected: FAIL porque no existe la pantalla pública ni `ApiClient.activate`.

- [ ] **Step 3: Añadir la operación HTTP mínima**

En `apps/web/src/api/client.ts`, añadir:

```ts
activate(input: {
  token: string;
  username: string;
  displayName: string;
  password: string;
}): Promise<TokenPair>;
```

Implementarla en `HttpApiClient` con `POST /auth/activate` y cuerpo JSON.

- [ ] **Step 4: Implementar la pantalla pública mínima**

En `apps/web/src/app.tsx`:

- Definir un esquema Zod con las restricciones del backend más `passwordConfirmation` igual a `password`.
- Añadir `ActivationPanel`, reutilizando `login-shell`, `login-panel`, `Alert` y `primary-button`.
- Leer el token con `new URLSearchParams(window.location.search).get('token')` solo cuando `window.location.pathname === '/activar'`.
- Deshabilitar el botón durante la solicitud y cuando falte token.
- En éxito, guardar `ACCESS_TOKEN_KEY` y `REFRESH_TOKEN_KEY`, cargar `api.getProfile()` y reutilizar el enrutamiento actual.
- En error, mostrar el mensaje, limpiar ambos campos de contraseña y conservar nombre/usuario.

- [ ] **Step 5: Ejecutar pruebas y verificar GREEN**

Run: `npm run test --workspace @credicuenta/web -- app.spec.tsx`

Expected: PASS para las cinco pruebas de activación.

- [ ] **Step 6: Ejecutar la prueba completa del frontend**

Run: `npm run test --workspace @credicuenta/web`

Expected: todas las pruebas pasan sin advertencias nuevas.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/app.tsx apps/web/src/app.spec.tsx
git commit -m "feat(web): activate invited users"
```

### Task 2: Entrega del enlace desde Plataforma

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/app.spec.tsx`

**Interfaces:**
- Consumes: `{ token }` devuelto por `ApiClient.createInvitation` y `window.location.origin`.
- Produces: enlace `${window.location.origin}/activar?token=${encodeURIComponent(token)}` visible, seleccionable y copiable una sola vez.

- [ ] **Step 1: Añadir pruebas fallidas del enlace de activación**

En `apps/web/src/app.spec.tsx`, añadir:

- `shows a one-time activation link after creating a business administrator invitation`: comprueba el enlace y que la invitación usa `platformRole: 'USER'` y `storeRole: 'STORE_ADMIN'`.
- `keeps the activation link selectable when clipboard access is unavailable`: comprueba un campo de solo lectura visible y que no falla sin `navigator.clipboard`.

- [ ] **Step 2: Ejecutar las pruebas para verificar RED**

Run: `npm run test --workspace @credicuenta/web -- app.spec.tsx -t "activation link"`

Expected: FAIL porque Plataforma aún muestra solo el token bruto.

- [ ] **Step 3: Implementar la entrega y el copiado mínimos**

En `PlatformWorkspace`:

- Sustituir `oneTimeToken` por `activationLink`.
- Formar el enlace inmediatamente después de crear la invitación.
- Mostrarlo en un `input readOnly` con etiqueta `Enlace de activación` y una nota de una sola visualización.
- Añadir `Copiar enlace`; usar `navigator.clipboard?.writeText(activationLink)` y mostrar una confirmación breve solo si está disponible y resuelve.
- Mantener el enlace visible como respaldo si el portapapeles falta o falla.

En `apps/web/src/styles.css`, añadir únicamente el grupo de campo/botón requerido.

- [ ] **Step 4: Ejecutar pruebas y verificar GREEN**

Run: `npm run test --workspace @credicuenta/web -- app.spec.tsx -t "activation link"`

Expected: PASS para las dos pruebas del enlace.

- [ ] **Step 5: Ejecutar verificación completa de la fase**

Run: `npm run lint --workspace @credicuenta/web`

Expected: exit 0.

Run: `npm run typecheck --workspace @credicuenta/web`

Expected: exit 0.

Run: `npm run test --workspace @credicuenta/web`

Expected: todas las pruebas pasan.

Run: `npm run build --workspace @credicuenta/web`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app.tsx apps/web/src/styles.css apps/web/src/app.spec.tsx docs/superpowers/specs/2026-11-03-invitation-activation-design.md docs/superpowers/plans/2026-11-03-invitation-activation.md
git commit -m "feat(web): share invitation activation links"
```
