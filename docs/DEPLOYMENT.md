# Despliegue academico sencillo

## Prueba local recomendada

1. Instale Docker Desktop.
2. Desde la raiz ejecute `docker compose up --build`.
3. Abra `http://localhost:8080` para el frontend y
   `http://localhost:3000/api/docs` para Swagger.
4. Cargue los datos ficticios una vez con
   `docker compose exec api npm exec --workspace @credicuenta/api -- prisma db seed`.

La API ejecuta `prisma migrate deploy` antes de iniciar. Los datos de Docker
son de demostracion y las claves del archivo compose no deben reutilizarse.
Si el puerto 3306 ya está ocupado, use por ejemplo
`$env:CREDICUENTA_DB_PORT=3308` antes de iniciar Docker.

Antes de entregar, valide sin Docker con:

```powershell
npm install
npm run test:integration:local
npm run lint
npm run typecheck
npm run build
npm run test:deployment:local
```

El último comando inicia temporalmente la compilación de producción en el
puerto 3100 y comprueba `/health/live` y `/health/ready`; luego la cierra.

## Render + Aiven

- Cree un MySQL gratuito en Aiven, copie su URL TLS como `DATABASE_URL` y no
  la guarde en Git.
- En Render cree un Web Service con el Dockerfile `apps/api/Dockerfile`.
  Configure `DATABASE_URL`, `JWT_ACCESS_SECRET`, `WEB_ORIGIN` y `PORT=3000`.
- Configure el health check de Render en `/api/v1/health/ready`.
- Cree el frontend como Web Service con runtime Docker y el archivo
  `apps/web/Dockerfile`. Configure
  `VITE_API_URL=https://SU_API.onrender.com/api/v1` como argumento de build.
- Después del primer despliegue ejecute la semilla solo para la demo.

La API ejecuta `prisma migrate deploy` automáticamente al iniciar. La semilla
no se ejecuta automáticamente para evitar sobrescribir o recrear usuarios de
demostración en cada reinicio.

La semilla prepara `CC-DEMO-PAGO` con una compra, un corte emitido y una
obligación vencida sin pago. Ejecútela una sola vez en cloud. Antes de la
exposición compruebe que la cuenta y la cotización estén visibles, pero reserve
el pago cloud para la demostración final: al pagarlo, la obligación queda
correctamente cerrada y no vuelve a aparecer como exigible.

Los planes gratuitos pueden suspenderse. Antes de exponer, abra primero
`/api/v1/health/ready`, inicie sesión y compruebe compra, corte y cotización.
El recorrido completo con pago y comprobante se ensaya en la base local
descartable descrita en `docs/TESTING.md`.

## Respaldo y restauracion

```powershell
mysqldump --host HOST --port PUERTO --user USUARIO --password --ssl CrediCuentaDB > credicuenta.sql
mysql --host HOST --port PUERTO --user USUARIO --password --ssl CrediCuentaDB < credicuenta.sql
```

Verifique el respaldo en una base vacia antes de considerarlo util. Nunca
suba `credicuenta.sql` si contiene datos reales o credenciales.
