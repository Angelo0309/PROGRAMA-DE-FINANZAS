# Product Image URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer imágenes de productos por URL en el catálogo del negocio y en los artículos de las compras consultadas por el cliente.

**Architecture:** Mantener `imageUrl` en `PRODUCTO_SERVICIO` como única fuente. El portal del cliente obtendrá los detalles de cada compra y la imagen vigente mediante la relación Prisma existente, sin modificar el esquema de la base de datos.

**Tech Stack:** NestJS 12, Prisma 7, Zod, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-product-image-urls-design.md`

## Global Constraints

- No crear carga ni almacenamiento de archivos.
- No permitir compras iniciadas por clientes.
- No crear migraciones.
- Los decimales continúan viajando como cadenas.
- `imageUrl` es opcional y solo admite `http` o `https`.

## Review Focus

- Producto sin imagen: debe seguir siendo válido y devolver `imageUrl: null`.
- URL con esquema no web: debe rechazarse con HTTP 400.
- Producto desactivado después de una compra: su relación e imagen deben seguir disponibles en el historial.
- Compra con varios artículos: cada artículo debe conservar su propio `productId` e imagen.
- Importes del detalle: deben permanecer como cadenas con precisión de presentación.

---

### Task 1: Contrato de URL del producto

**Files:**
- Modify: `apps/api/src/modules/business/business.controller.spec.ts`
- Modify: `apps/api/src/modules/business/business.controller.ts`

**Interfaces:**
- Consumes: `POST /api/v1/stores/:storeId/products`.
- Produces: `imageUrl?: string` limitado a los protocolos HTTP y HTTPS.

- [x] Escribir una prueba que rechace `ftp://example.com/image.jpg` y acepte una URL HTTPS.
- [x] Ejecutar la prueba y comprobar que falla por aceptar FTP.
- [x] Restringir `productSchema.imageUrl` a HTTP/HTTPS.
- [x] Ejecutar la prueba y comprobar que pasa.

### Task 2: Imágenes en las compras del cliente

**Files:**
- Modify: `apps/api/src/modules/portal/portal.service.spec.ts`
- Modify: `apps/api/src/modules/portal/portal.service.ts`
- Modify: `apps/web/src/api/client.ts`

**Interfaces:**
- Consumes: relación `Purchase.details[].product.imageUrl`.
- Produces: `/me/purchases[].items[]` con `productId`, `description`, `quantity`, `unitPrice`, `lineTotal` e `imageUrl`.

- [x] Escribir una prueba de mapeo con un producto con imagen y otro sin imagen.
- [x] Ejecutar la prueba y comprobar que falla porque `items` no existe.
- [x] Incluir detalles y producto en la consulta Prisma y mapear los campos como cadenas.
- [x] Actualizar el tipo del cliente web sin modificar componentes visuales.
- [x] Ejecutar las pruebas y el typecheck.

### Task 3: Datos demostrativos y verificación

**Files:**
- Modify: `apps/api/prisma/seed.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: dos productos ficticios con URLs HTTPS utilizables por el frontend.

- [x] Añadir URLs públicas a los productos de la semilla.
- [x] Ejecutar lint, typecheck, todas las pruebas y build.
- [x] Revisar el diff y crear un commit local convencional.
