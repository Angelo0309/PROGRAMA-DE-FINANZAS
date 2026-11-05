# Guía para trabajar con IA en CrediCuenta

Esta guía establece cómo usar asistentes de inteligencia artificial sin comprometer la seguridad, la coherencia financiera ni el trabajo de los demás integrantes. La IA puede proponer, explicar, escribir pruebas y ayudar a implementar, pero cada integrante sigue siendo responsable de revisar y validar lo que incorpora.

## Antes de comenzar: identifica tu rol

- Angelo es el **Integrante 1: coordinador e integración**. Revisa Pull Requests y concentra los cambios de API financiera, contratos, Prisma, nube y reglas de negocio.
- Los otros cuatro compañeros deben acordar una sola vez quién será el Integrante 2, 3, 4 y 5 según la tabla de responsabilidades de la sección 6.
- Al iniciar cada conversación, el compañero debe decirle a la IA qué integrante es. La IA no debe asumirlo; si el rol no fue indicado, debe preguntar antes de modificar archivos.

Mensaje inicial recomendado:

```text
Soy el Integrante __ del equipo CrediCuenta y trabajo en la rama feature/____.
Lee docs/equipo/GUIA_USO_IA.md y respeta la responsabilidad y los límites asignados a mi integrante.
Mi tarea concreta es: ____.
Antes de modificar archivos, confirma qué área me corresponde y qué partes no debes tocar.
Trabaja únicamente con el entorno local; no uses Aiven, Render ni credenciales cloud.
```

## 1. Preparación antes de pedir cambios

1. Actualiza `main` y crea tu propia rama:

   ```powershell
   git switch main
   git pull origin main
   git switch -c feature/nombre-de-tu-tarea
   ```

2. Confirma que el repositorio está limpio:

   ```powershell
   git status --short
   ```

3. Explica a la IA cuál es tu tarea, qué archivos te corresponden y qué áreas no debe tocar.
4. Pídele que lea primero `README.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md` y esta guía.
5. Si la tarea depende de un endpoint o campo inexistente, consulta al coordinador antes de cambiar la API.

## 2. Contexto mínimo que debe recibir la IA

Incluye siempre:

- Rama actual y objetivo concreto.
- Rol del integrante y archivos bajo su responsabilidad.
- Criterios de aceptación observables.
- Pruebas que deben añadirse o actualizarse.
- Prohibición de modificar otras funcionalidades.
- Indicación de preservar cualquier cambio local ajeno.

Plantilla recomendada:

```text
Estoy trabajando en CrediCuenta, rama feature/____.
Mi tarea es: ____.
Puedo modificar: ____.
No debo modificar: Prisma, operaciones financieras, pagos, cortes, OpenAPI ni archivos de otros compañeros.
Criterios de aceptación:
1. ____
2. ____
3. ____

Antes de implementar, revisa el código existente y propón el cambio mínimo.
Trabaja con pruebas y ejecuta lint, typecheck, tests y build al terminar.
No muestres ni escribas secretos, archivos .env o credenciales cloud.
```

## 3. Reglas obligatorias de seguridad

- Nunca pegar en el chat `DATABASE_URL`, contraseñas, tokens JWT, enlaces privados de Aiven o secretos de Render.
- Nunca permitir que la IA agregue `.env`, respaldos SQL o credenciales al repositorio.
- Usar solamente datos ficticios.
- No ejecutar `prisma db seed` contra Aiven salvo autorización expresa del coordinador.
- No registrar el pago cloud de `CC-DEMO-PAGO` durante desarrollo.
- No usar `git push --force` sobre `main` ni borrar ramas de otros integrantes.
- No ejecutar comandos destructivos como `git reset --hard`, borrado de bases o eliminación de migraciones sin aprobación.
- Revisar cualquier dependencia nueva antes de instalarla; preferir las dependencias existentes.

## 4. Límites financieros y técnicos

La IA no debe cambiar por iniciativa propia:

- Cálculo de intereses compensatorios o moratorios.
- Método francés, fechas de corte o vencimiento.
- Redondeo financiero y manejo de decimales.
- Prelación mora, interés compensatorio y capital.
- Idempotencia, transacciones o aislamiento.
- Esquema Prisma, migraciones o semilla.
- Contrato OpenAPI o tipos compartidos.

Si una funcionalidad necesita uno de estos cambios, detén la implementación y solicita revisión al coordinador.

El frontend nunca debe recalcular importes oficiales. Debe mostrar los valores recibidos desde la API.

## 5. Flujo recomendado con IA

### Paso 1. Diagnóstico

Pide a la IA que localice la pantalla, pruebas y tipos relacionados. No autorices todavía cambios amplios.

### Paso 2. Diseño pequeño

Solicita una propuesta que indique:

- archivos que modificará;
- comportamiento esperado;
- casos límite;
- pruebas necesarias;
- riesgos de conflicto con otras tareas.

### Paso 3. Prueba que falle

Para una funcionalidad o corrección, escribe primero una prueba que demuestre lo que falta. Comprueba que falla por la razón esperada.

### Paso 4. Implementación mínima

Autoriza únicamente el cambio necesario para aprobar la prueba. Evita refactorizaciones generales dentro del mismo Pull Request.

### Paso 5. Verificación

Ejecuta:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Cuando la tarea toque backend, datos o contratos, coordina también:

```powershell
npm run test:integration:local
```

### Paso 6. Revisión humana

Antes de hacer commit:

```powershell
git diff --check
git status --short
git diff
```

Comprueba que no haya archivos ajenos, secretos, cálculos duplicados ni cambios no solicitados.

## 6. Archivos y responsabilidades por integrante

| Integrante | Tarea | Carpeta principal | Áreas que debe evitar |
| --- | --- | --- | --- |
| 1 Coordinador | Integración, API financiera, contratos y nube | `apps/api`, `docs/openapi.yaml`, `apps/web/src/api` | No incorporar cambios sin pruebas y revisión |
| 2 | Planes de pago del cliente | `apps/web/src/components/client` | Pagos, invitaciones, Prisma y operaciones financieras |
| 3 | Detalle e historial de compras | `apps/web/src/components/purchases` | Planes del cliente, pagos e invitaciones |
| 4 | Historial de pagos y comprobantes | `apps/web/src/components/payments` | Cálculo y asignación interna de pagos |
| 5 | Usuarios e invitaciones | `apps/web/src/components/platform` | Compras, planes, pagos y reglas financieras |

Si las carpetas todavía no existen, pueden crearse. La conexión final con `app.tsx` debe coordinarse para que solo una persona la modifique durante cada integración.

## 7. Cómo pedir una revisión a la IA

```text
Revisa únicamente el diff de mi rama contra origin/main.
Busca errores funcionales, pérdida de autorización por rol, cálculos en frontend, exposición de secretos, ausencia de pruebas y conflictos con las responsabilidades del equipo.
No modifiques archivos. Ordena los hallazgos por gravedad e indica archivo y línea.
```

No aceptes automáticamente todas las sugerencias. Comprueba cada observación contra los requisitos y el código real.

## 8. Commit y Pull Request

Usa mensajes convencionales:

```powershell
git add ruta/de/los/archivos
git commit -m "feat(web): describe la funcionalidad"
git push -u origin feature/nombre-de-tu-tarea
```

El Pull Request debe incluir:

- Resumen del cambio.
- Pantallas o módulos afectados.
- Pruebas ejecutadas y resultados.
- Riesgos o tareas pendientes.
- Capturas únicamente cuando ayuden a revisar la interfaz.

No fusiones tu propio Pull Request. El coordinador revisará el alcance, resolverá dependencias entre tareas y ejecutará la validación final.

## 9. Señales para detenerse y consultar

Detén el trabajo cuando:

- La IA propone cambiar Prisma, migraciones o reglas financieras.
- El endpoint necesario no existe.
- Aparecen conflictos en `app.tsx`, `client.ts` u OpenAPI.
- Una prueba existente deja de pasar fuera de tu módulo.
- Se requiere una credencial cloud.
- La solución exige borrar o recrear datos.
- No puedes explicar qué hace un cambio generado.

La prioridad es conservar un sistema verificable y una historia Git clara. Es mejor entregar un cambio pequeño y probado que una modificación amplia difícil de revisar.
