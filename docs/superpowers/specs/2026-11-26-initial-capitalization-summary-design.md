# Resumen de capitalización inicial

## Intención

Hacer visible el periodo de gracia total automático exigido por el enunciado final, sin modificar el cálculo financiero existente. Para una compra en cuotas, el usuario debe poder reconocer las fechas del periodo inicial, sus días comerciales, el capital original, el interés capitalizado y el capital usado para calcular las cuotas.

## Alcance

- El backend calcula y entrega un resumen por plan de compra en modalidad `INSTALLMENTS`.
- El periodo empieza en la fecha comercial de compra y termina un mes antes del primer vencimiento.
- Los días se calculan con la convención 30/360 ya usada por el motor financiero.
- El interés capitalizado es la diferencia entre el saldo inicial de la primera cuota y el capital original del crédito.
- El resumen se muestra al seleccionar un plan en la administración, en el detalle de compra del cliente y en el plan de pagos del cliente.
- Las compras de fin de mes no muestran este resumen porque no usan el cronograma francés de cuotas del requisito.

## Fuera de alcance

- No se agregan periodos de gracia parcial ni modalidades mixtas.
- No se modifica el esquema de la base de datos.
- No se recalculan cuotas en el navegador.

## Enfoques considerados

1. Calcular todo en el frontend a partir de fechas y cuotas. Se descarta porque duplicaría reglas financieras y podría divergir del backend.
2. Crear un endpoint nuevo para el resumen. Se descarta porque las pantallas ya consumen el cronograma y aumentaría llamadas sin necesidad.
3. Incluir un objeto `capitalization` en cada fila del cronograma. Se elige porque mantiene compatibles los endpoints existentes, permite agrupar por compra y deja el cálculo en el backend.

## Presentación

El bloque debe mostrar: periodo inicial capitalizado, rango de fechas, capital original, interés capitalizado y capital para calcular las cuotas. No debe representarse como una cuota adicional.

