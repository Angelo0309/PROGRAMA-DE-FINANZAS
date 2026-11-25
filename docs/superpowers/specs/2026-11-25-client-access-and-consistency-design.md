# Diseño: acceso de clientes y consistencia operativa

## Objetivo

Completar el flujo entre la ficha comercial de un cliente y su acceso al portal, eliminar la apariencia de clientes duplicados y mostrar vencimientos con un estado coherente incluso si el proceso programado aún no ha corrido.

## Decisiones

### Invitación vinculada a la ficha del cliente

La invitación llevará un `customerId` opcional. Las invitaciones generales de plataforma seguirán funcionando sin ese dato. Una invitación emitida desde el directorio de clientes siempre tendrá:

- tienda de la ficha;
- rol `CLIENT`;
- ficha del cliente destinatario;
- correo, vencimiento y token de un solo uso.

Al aceptar la invitación se crearán el usuario y su acceso a la tienda, y se asignará el nuevo usuario a la ficha del cliente dentro de la misma transacción. Si la ficha ya tiene usuario, la operación se rechazará.

### Directorio sin duplicados visuales

El directorio tendrá una fila por cliente. Sus cuentas se resumirán en esa fila y seguirán apareciendo individualmente en el panel de detalle. Dos cuentas de María no volverán a parecer dos clientes.

### Vencimientos consistentes

Una obligación pendiente con fecha anterior al día consultado se devolverá como `OVERDUE` para su visualización. Esto no reemplaza el proceso programado ni altera importes: evita que la interfaz dependa de que ese proceso haya corrido justo antes de una consulta.

### Alcance conservado

Los pagos continuarán siendo pagos completos del importe exigible. Los pagos parciales y anticipados no forman parte del alcance original y no se agregarán en esta entrega.

## Seguridad y trazabilidad

- Solo un administrador de la tienda puede invitar al portal a un cliente.
- No se devuelve el hash del token; el token en claro se muestra una sola vez.
- Se audita la emisión de la invitación.
- La activación mantiene la atomicidad entre usuario, acceso y ficha del cliente.

## Entregas

1. Acceso del cliente mediante invitación vinculada.
2. Directorio agrupado y estados de vencimiento coherentes.
3. Textos, plurales, claridad de roles y verificación integral.
