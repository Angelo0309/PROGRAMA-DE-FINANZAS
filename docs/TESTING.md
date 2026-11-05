# Pruebas

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e --workspace @credicuenta/web
```

La integracion MariaDB se habilita al definir `TEST_DATABASE_URL` además de
`DATABASE_URL`. En ese modo se verifica semilla, login y el recorrido
idempotente compra-corte-pago.

```powershell
$env:DATABASE_URL='mysql://credicuenta:CLAVE@127.0.0.1:3306/CrediCuentaDB'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm test --workspace @credicuenta/api -- database.integration.spec.ts
```

La prueba Playwright intercepta la API para comprobar el aislamiento visual
del rol cliente. Las pruebas de repositorio reales se ejecutan contra MariaDB.

## Prueba integral local sencilla

Con MariaDB encendido y `apps/api/.env` configurado, ejecute desde la raíz:

```powershell
npm run test:integration:local
```

El comando intenta crear una base separada llamada `credicuenta_test`. Si el
usuario no puede crear bases, usa la base estándar `test` únicamente cuando
está vacía o ya corresponde a CrediCuenta. Luego aplica migraciones, carga exclusivamente datos ficticios y
prueba login, activación, compra, corte, pago, portal del cliente, idempotencia,
concurrencia y rechazo de acceso a otra tienda. No modifica `credicuentadb`.
Antes de cada ejecución limpia únicamente las tablas reconocidas de esa base
aislada, por lo que las pruebas no acumulan clientes, compras ni pagos.
La semilla crea `CC-DEMO-PAGO` todavía pendiente; la prueba de integración
cotiza su deuda al 2026-11-03, registra exactamente el pago completo, valida el
comprobante y descarta después toda la base de prueba. Este ensayo no consume
el escenario conservado en Aiven para la exposición.
