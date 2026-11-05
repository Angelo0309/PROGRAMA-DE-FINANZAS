# Diseño breve: imágenes de productos mediante URL

## Intención

Preparar el contrato entre backend y frontend para mostrar imágenes de productos sin incorporar carga de archivos. El negocio seguirá registrando las compras y el cliente únicamente consultará sus compras realizadas, conforme al alcance acordado.

## Alcance

- Conservar `imageUrl` como dato opcional del producto.
- Aceptar únicamente direcciones `http` o `https`.
- Devolver la imagen vigente del producto en los artículos de `/me/purchases`.
- Añadir imágenes públicas a los productos ficticios de la semilla.
- Actualizar el tipo consumido por el frontend, sin cambiar aún la interfaz visual.

## Fuera de alcance

- Subida o almacenamiento de archivos.
- Catálogo de autoservicio o compras iniciadas por clientes.
- Copia histórica de la imagen en `DETALLE_COMPRA`.
- Cambios visuales del frontend.

## Enfoques considerados

1. URL vigente del producto, elegido por ser el cambio mínimo y no requerir migración.
2. Copia histórica de la URL en cada detalle de compra, descartada por requerir una migración innecesaria para la entrega académica.

Si la URL no responde, el frontend será responsable de mostrar una imagen de reemplazo.
