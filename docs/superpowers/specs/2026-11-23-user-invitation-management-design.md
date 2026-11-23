# Diseño: gestión de usuarios e invitaciones

**Fecha:** 2026-11-23
**Rama:** `feature/user-invitation-management`

## Intención

Completar la responsabilidad del integrante 5 para que el administrador de plataforma pueda consultar los usuarios y sus roles, revisar el ciclo de vida de las invitaciones y revocar una invitación pendiente, sin alterar las reglas financieras ni los módulos desarrollados por los demás integrantes.

## Estado actual

- El esquema ya contiene usuarios, accesos por tienda, roles y los estados `PENDING`, `ACCEPTED`, `EXPIRED` y `REVOKED`.
- La API permite crear invitaciones y activar al usuario, pero no permite consultar su historial ni revocarlas.
- La web permite crear y copiar un enlace de activación dentro de `app.tsx`, pero no muestra usuarios ni estados de invitaciones.
- No existe todavía `apps/web/src/components/platform`.

## Alcance aprobado

- Añadir una consulta protegida para listar usuarios, sus roles, tiendas asociadas y estado activo/inactivo.
- Añadir una consulta protegida para listar invitaciones sin exponer el token ni su hash.
- Presentar como vencida una invitación pendiente cuya fecha límite ya pasó.
- Permitir revocar únicamente invitaciones pendientes y no vencidas.
- Registrar la revocación en auditoría.
- Crear el componente de plataforma con tablas de usuarios e invitaciones, creación de invitaciones, enlace de activación de un solo uso y revocación.
- Integrar el componente en `app.tsx` y cubrir API, interfaz y autorización con pruebas.

## Fuera de alcance

- Editar perfiles, nombres, correos o contraseñas.
- Crear un CRUD general de usuarios.
- Cambiar Prisma o añadir migraciones.
- Modificar compras, planes, pagos, cálculos financieros o portales de clientes.
- Exponer tokens antiguos o hashes de invitación.

## Autorización y seguridad

- Todos los endpoints nuevos quedarán bajo `JwtAccessGuard` y `PlatformAdminGuard`.
- La lista de usuarios no devolverá `passwordHash`, sesiones ni otros datos internos.
- La lista de invitaciones no devolverá `tokenHash`; el token seguirá apareciendo solamente al crear una invitación.
- La revocación rechazará invitaciones aceptadas, revocadas o vencidas.

## Comportamiento de estados

- `PENDING`: todavía puede utilizarse o revocarse.
- `ACCEPTED`: ya fue utilizada.
- `EXPIRED`: era pendiente, pero su fecha límite ya pasó; se presentará así aunque el registro todavía conserve el valor pendiente.
- `REVOKED`: fue anulada por el administrador y ya no puede utilizarse.

## Contrato propuesto

- `GET /platform/users`: usuarios con rol de plataforma, estado y accesos por tienda.
- `GET /platform/invitations`: invitaciones ordenadas desde la más reciente, con tienda, roles, fechas y estado efectivo.
- `POST /platform/invitations/{invitationId}/revoke`: revocación lógica de una invitación pendiente y registro de auditoría.

## Enfoques considerados

1. **Solo interfaz con datos simulados.** Es pequeño, pero no prueba el funcionamiento real ni satisface el listado solicitado. Se descartó.
2. **Flujo vertical mínimo sobre el modelo existente.** Añade los tres endpoints, el componente y las pruebas, sin cambiar la base de datos. Es el enfoque elegido porque completa el requisito con el menor riesgo.
3. **CRUD completo de usuarios.** Añadiría edición, desactivación y reasignación de roles. Se descartó porque excede el alcance acordado y aumenta el riesgo antes de la entrega.

## Verificación

- Pruebas de servicio para datos expuestos, estados efectivos y reglas de revocación.
- Pruebas de controlador para autorización y contrato HTTP.
- Pruebas del componente para listas, estados, creación, copia y revocación.
- Prueba de integración en `app.spec.tsx`.
- `lint`, comprobación de tipos, pruebas completas, compilación y pruebas locales de integración/despliegue.
