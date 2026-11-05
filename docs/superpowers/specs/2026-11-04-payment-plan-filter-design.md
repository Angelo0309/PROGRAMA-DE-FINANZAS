# Diseño: filtro de planes de pago por compra

## Intención

Permitir que el administrador del negocio consulte el cronograma de una cuenta por plan de pago, o vea todos los planes juntos con un identificador visible. Esto evita mezclar cuotas de compras distintas y mejora la lectura del reporte durante la operación y la exposición.

## Estado actual

- La pantalla **Plan de pagos** permite elegir una cuenta mediante una opción que ya muestra cliente y número de cuenta.
- La API devuelve todas las obligaciones de esa cuenta.
- Cada obligación ya contiene el `purchaseId`, pero no la fecha de compra.
- La tabla mezcla las obligaciones de todas las compras y no muestra a qué plan pertenece cada fila.

## Objetivos

- Mantener el selector actual de cuenta del cliente.
- Limitar la consulta y la opción **Todos los planes** a la cuenta seleccionada; no reunir planes de otras cuentas del mismo cliente.
- Añadir un selector de plan después de cargar el cronograma.
- Ofrecer **Todos los planes** como opción predeterminada.
- Identificar cada plan como `Compra DD/MM/AAAA · CÓDIGO`, donde `CÓDIGO` son los primeros ocho caracteres del `purchaseId` en mayúsculas.
- En la vista de todos los planes, añadir una columna **Plan** a cada fila.
- Al elegir un plan, mostrar únicamente sus obligaciones y calcular sobre esas filas el número de obligaciones y el próximo vencimiento.
- Conservar el límite de crédito y el capital original pendiente como métricas globales de la cuenta.

## No objetivos

- No crear un módulo nuevo de reportes.
- No crear una vista agregada que mezcle varias cuentas del cliente.
- No modificar el modelo de datos ni crear migraciones.
- No cambiar reglas financieras, pagos, cortes ni asignaciones.
- No filtrar todavía el portal del cliente; este cambio se limita a la vista administrativa del negocio.
- No convertir el código corto en una clave de negocio: el sistema seguirá usando el `purchaseId` completo.

## Enfoques considerados

### 1. Agrupar en la interfaz con metadatos adicionales — elegido

La API añade `purchasedAt` a cada obligación del cronograma. La interfaz agrupa por el `purchaseId` ya existente, construye las etiquetas, filtra localmente y añade la columna **Plan** cuando se muestran todos.

Ventajas: cambio pequeño, una sola consulta, sin migración y consistente con la pantalla actual. Riesgo: el agrupamiento vive en la interfaz, aceptable para el volumen académico previsto.

### 2. Una tabla independiente por plan

Evita un selector, pero ocupa demasiado espacio y resulta difícil de revisar cuando la cuenta tiene varias compras.

### 3. Endpoint dedicado de reportes de planes

Facilitaría filtros futuros, pero duplicaría consulta, contrato y mantenimiento sin una necesidad actual.

## Contrato de API

Los cronogramas administrativos y del cliente incluirán de forma aditiva:

```ts
interface ScheduleItemView {
  purchaseId: string;
  purchasedAt: string;
  // campos existentes
}
```

`purchasedAt` se obtiene desde la compra relacionada y se devuelve como fecha/hora ISO. Se actualizarán el tipo web y OpenAPI. No cambia ninguna ruta ni parámetro.

## Comportamiento de la interfaz

1. Sin cuenta seleccionada, se mantiene el estado vacío actual.
2. Al elegir una cuenta, se obtiene una sola vez todo su cronograma; ninguna obligación de otra cuenta entra en el resultado.
3. La lista de planes se deriva de las obligaciones, ordenada por fecha de compra descendente y luego por identificador.
4. El selector muestra primero **Todos los planes** y después una opción por compra.
5. En **Todos los planes**, la tabla muestra la columna **Plan** y todas las obligaciones.
6. En un plan específico, la tabla omite esa columna redundante y muestra solo sus obligaciones; el encabezado indica la etiqueta seleccionada.
7. Cambiar de cuenta restablece el selector a **Todos los planes**.
8. Compras realizadas el mismo día siguen siendo distinguibles por el código corto.

## Pruebas

- API: el cronograma devuelve `purchasedAt` de la compra relacionada con formato ISO.
- Web: dos compras de una misma cuenta producen dos opciones identificables.
- Web: **Todos los planes** muestra ambas y la columna **Plan**.
- Web: elegir un plan filtra filas, conteo y próximo vencimiento.
- Web: cambiar de cuenta restablece el filtro y mantiene la protección contra respuestas tardías ya existente.
- Verificación completa: lint, tipos, pruebas, build e integración local.

## Riesgos y límites

- El código corto es solo presentación y no reemplaza el UUID completo.
- El filtro no reduce datos transferidos; si en el futuro una cuenta acumula un volumen alto de obligaciones, se evaluará filtrado o paginación en backend.
- Las compras de fin de mes con una sola obligación también aparecen como un plan, porque pertenecen a una compra identificable.
