# Diseño de datos financieros deterministas para demostración

**Fecha:** 2026-11-03  
**Estado:** aprobado  
**Objetivo:** disponer de una cuenta ficticia separada que muestre un corte emitido y una obligación vencida, y que permita registrar un pago completo sin cambiar la fecha del equipo.

## Intención

La exposición necesita demostrar el ciclo financiero completo con datos comprensibles y repetibles. La cuenta actual se conserva para compras futuras; una segunda cuenta del mismo cliente ficticio quedará preparada exclusivamente para consultar el corte, obtener el importe oficial exigible y efectuar el pago final.

## Metas

- Crear la cuenta `CC-DEMO-PAGO` sin modificar la cuenta principal `CC-000001`.
- Generar una compra de fin de mes con fecha fija anterior al 2026-11-03.
- Generar el corte correspondiente mediante el motor financiero existente.
- Dejar la obligación pendiente y vencida para que la interfaz calcule mora y el importe exacto al día de la demostración.
- Permitir que el administrador del negocio registre un único pago completo y consulte el comprobante.
- Hacer que una segunda ejecución de la semilla no duplique la compra ni el corte.

## No metas

- No crear pagos desde la semilla.
- No cambiar reglas financieras, contratos HTTP, migraciones ni pantallas.
- No añadir una función pública para reiniciar pagos.
- No reabrir ni eliminar obligaciones ya pagadas al volver a ejecutar la semilla.
- No cargar datos reales ni registrar secretos en el repositorio.

## Restricciones

- Zona comercial `America/Lima` y fechas con desplazamiento `-05:00`.
- Los cálculos oficiales deben pasar por `CreditOperationsService`; la semilla no copiará fórmulas ni insertará importes calculados manualmente.
- Se reutilizarán `PrismaCreditOperationsRepository`, los productos ficticios existentes y el administrador del negocio ficticio.
- La escritura en Aiven se realizará una sola vez después de aprobar pruebas locales.
- El pago completo en cloud se reservará para la exposición. Los ensayos que consumen el pago usarán la base local descartable de integración.

## Enfoques considerados

### 1. Reutilizar el motor financiero existente — elegido

La semilla crea la cuenta y condición mediante Prisma, y utiliza `CreditOperationsService` para la compra y el corte. Las claves de idempotencia estables evitan duplicados y preservan las mismas invariantes que el API.

**Ventajas:** una sola fuente de reglas financieras, menor riesgo de inconsistencias y prueba realista.  
**Costo:** la semilla importa el repositorio y servicio de operaciones.

### 2. Insertar todas las tablas con Prisma

Sería más directo, pero obligaría a duplicar tasas, cronogramas, saldos y relaciones de auditoría. Se descarta porque una semilla aparentemente válida podría no representar lo que produce la aplicación.

### 3. Crear el escenario llamando al API desplegado

Usaría el contrato público, pero dependería de autenticación, disponibilidad de Render y red para preparar la base. Se descarta para que la preparación sea verificable localmente antes de tocar cloud.

## Escenario seleccionado

1. La semilla conserva los tres usuarios, tienda, cliente, cuenta principal y productos existentes.
2. Crea o reactiva `CC-DEMO-PAGO` para el mismo cliente ficticio, con límite de S/ 1,000 y la misma política financiera de la cuenta principal.
3. Registra mediante el servicio una compra de `PROD-001` por una unidad, con fecha `2026-09-20T10:00:00-05:00`, modalidad fin de mes y clave `demo-payable-purchase-v1`.
4. El motor asigna corte y vencimiento. La semilla crea el corte usando la misma clave determinista que usaría el programador automático para evitar carreras.
5. No crea pago. El monto exigible se obtiene en tiempo real desde el cotizador; por eso la mora puede crecer con la fecha sin alterar datos manualmente.

## Idempotencia y seguridad de datos

- Cuenta y condición: `upsert` por número de cuenta y versión.
- Compra: clave idempotente estable del servicio.
- Corte: clave `auto:<accountId>:<cutAt>`, compatible con el programador automático.
- Una nueva ejecución puede reparar datos base faltantes, pero nunca borra pagos, comprobantes ni auditoría existente.
- Si la obligación ya fue pagada, permanece pagada. Repetir una exposición completa requerirá una base local limpia o un futuro mecanismo de reinicio explícito.

## Verificación

La prueba de integración sobre la base descartable comprobará que:

- existe `CC-DEMO-PAGO`;
- posee exactamente la compra y el corte deterministas;
- la obligación está vencida y pendiente antes del pago;
- la cotización para `2026-11-03T12:00:00-05:00` es positiva;
- el servicio acepta exactamente ese importe, genera comprobante y marca la obligación como pagada;
- volver a ejecutar compra, corte o pago con la misma clave devuelve el mismo registro.

Después se ejecutarán lint, tipos, pruebas, build e integración MariaDB local. Solo con todo verde se hará commit, push, despliegue y la carga única en Aiven.

## Riesgo operativo conocido

El pago cloud completa definitivamente el escenario pendiente: no borra información, pero cambia la obligación a pagada y deja de existir un importe exigible en esa cuenta. Antes de la presentación se validarán en cloud el login, la cuenta, el corte y la cotización, pero el botón de pago se probará completamente en local y se reservará en cloud para la exposición final.
