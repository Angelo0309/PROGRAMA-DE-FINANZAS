# Plan de implementación: acceso de clientes y consistencia

> Rama de trabajo: `feature/user-invitation-management`

## Task 1: acceso de cliente vinculado

**Archivos principales:** esquema y migración Prisma, repositorio de autenticación, servicio/controlador de negocio, contrato OpenAPI, cliente web, directorio de clientes y pruebas.

1. Agregar pruebas que exijan que una invitación de cliente se cree para una ficha válida, rechace fichas ya vinculadas y conecte la ficha al aceptar.
2. Ejecutar las pruebas y comprobar que fallan por la funcionalidad ausente.
3. Agregar la relación opcional entre invitación y cliente, junto con su migración.
4. Implementar el comando protegido para emitir la invitación y la activación atómica.
5. Exponer el estado de acceso en el directorio y permitir emitir/copiar el enlace una sola vez.
6. Actualizar OpenAPI y tipos generados.
7. Ejecutar pruebas focalizadas y crear un commit grande.

## Task 2: directorio y vencimientos

**Archivos principales:** servicio de negocio/portal, directorio y planes de pago, pruebas.

1. Agregar una prueba visual con un cliente que tenga dos cuentas y exigir una sola fila.
2. Agregar pruebas de frontera para obligación pendiente vencida, al día y pagada.
3. Agrupar cuentas por cliente y mostrar totales en el directorio.
4. Calcular el estado efectivo al consultar planes de pago.
5. Ejecutar pruebas focalizadas y crear un commit grande.

## Task 3: claridad y verificación

**Archivos principales:** gestión de usuarios, reportes, textos de interfaz y pruebas.

1. Corregir plurales y etiquetas de roles ambiguas.
2. Revisar selectores largos y estados vacíos sin cambiar el diseño general.
3. Ejecutar pruebas de API y web, comprobación de tipos y compilación.
4. Revisar la diferencia completa y crear el commit final de esta entrega.

