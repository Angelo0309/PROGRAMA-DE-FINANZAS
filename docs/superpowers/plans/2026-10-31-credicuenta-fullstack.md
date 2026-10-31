# CrediCuenta Full Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir CrediCuenta como monolito modular web, comenzando por el backend y terminando con una demo desplegable.

**Architecture:** Monorepo npm con API NestJS, frontend React y Prisma ORM sobre MariaDB/MySQL. El motor financiero es puro, usa Decimal y se valida antes de integrarse a operaciones transaccionales.

**Tech Stack:** Node.js 24 LTS, TypeScript, NestJS 12, Prisma ORM 7, MariaDB/MySQL, React, Vite, Material UI, Vitest y Playwright.

**Spec:** `SI642_Enunciado del Trabajo Final 2026-20.pdf` y `output/documentos/Informe_Grupo2_Primer_Hito_Corregido.docx`.

## Global Constraints

- Base financiera 30/360, zona America/Lima y redondeo HALF_UP solo al presentar o cobrar.
- Importes y tasas cruzan la API como cadenas decimales.
- No se permiten pagos parciales, anticipos ni mezcla de monedas.
- Toda operacion queda aislada por tienda y las operaciones criticas son atomicas e idempotentes.
- La primera version usa datos ficticios y no incluye inventario, impuestos ni pasarela real.

## Review Focus

- Frontera exacta del corte y calendario con dias inexistentes.
- Tasa cero, conversion nominal y precision de tasas.
- Concurrencia en limite de credito y pagos duplicados.
- Acceso cruzado entre tiendas o roles.
- Conciliacion entre componentes exactos y total monetario redondeado.

---

### Task 1: Repositorio y entorno reproducible

- [ ] Inicializar Git, rama de trabajo, workspaces, reglas de estilo, variables y documentacion local.
- [ ] Crear esqueletos compilables de API y web.
- [ ] Instalar dependencias con lockfile y verificar build, tipos y pruebas base.

### Task 2: Motor financiero probado

- [ ] Crear primero pruebas fallidas para calendario, tasas, fin de mes, plan frances y deuda exigible.
- [ ] Implementar funciones puras con Decimal y Luxon.
- [ ] Validar los casos numericos y bordes del informe.

### Task 3: Base de datos, identidad y seguridad

- [ ] Modelar las tablas de negocio, invitaciones y sesiones en Prisma.
- [ ] Implementar activacion, login, refresh, logout y autorizacion por tienda.
- [ ] Crear semillas ficticias y pruebas de seguridad e integracion.

### Task 4: Operaciones del negocio

- [ ] Implementar tiendas, clientes, condiciones, catalogo, compras, obligaciones, cortes, pagos y auditoria.
- [ ] Usar transacciones serializables, bloqueo de cuenta, reintentos e idempotencia.
- [ ] Probar el recorrido completo y los rechazos exigidos.

### Task 5: Frontend por roles

- [ ] Crear areas de plataforma, negocio y cliente con cliente OpenAPI.
- [ ] Implementar ayuda contextual, validaciones y flujo principal.
- [ ] Probar formularios, permisos y recorrido E2E.

### Task 6: CI, documentacion y despliegue academico

- [ ] Configurar GitHub Actions, Dockerfiles, health checks y migraciones de despliegue.
- [ ] Documentar Render, Aiven, respaldo, restauracion y preparacion de la demo.
- [ ] Ejecutar verificacion final y preparar release `v1.0.0-entrega-final` sin publicar ni empujar sin autorizacion.
