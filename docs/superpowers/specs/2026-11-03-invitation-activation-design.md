# Activación de usuario por invitación

## Intención

Completar el recorrido académico de alta de usuario sin habilitar un registro público irrestricto. Un administrador de plataforma crea una invitación para una tienda; la persona invitada abre un enlace de un solo uso, define sus datos y contraseña, y entra al sistema con el rol asignado.

## Objetivos

- Exponer una pantalla pública de activación accesible mediante `/activar?token=...`.
- Pedir nombre visible, nombre de usuario, contraseña y confirmación de contraseña.
- Validar en el navegador las mismas restricciones relevantes que ya aplica `POST /auth/activate`.
- Consumir la activación existente, conservar los tokens devueltos y cargar el perfil para dirigir al usuario a su portal.
- Mostrar en Plataforma un enlace de activación que pueda copiarse y que solo esté disponible en la respuesta de creación.
- Mantener el aspecto visual, la accesibilidad y el comportamiento adaptable de la pantalla actual de inicio de sesión.

## No objetivos

- No crear registro abierto por correo.
- No enviar correos ni integrar un proveedor de mensajería.
- No cambiar el contrato del backend ni la vigencia o seguridad de los tokens.
- No almacenar ni volver a consultar el token de invitación una vez abandonada la respuesta que lo contiene.
- No convertir la aplicación en un sistema complejo de rutas; solo se distinguirá la entrada pública de activación.

## Restricciones

- El token se obtiene exclusivamente del parámetro `token` de la URL y no se muestra como campo editable.
- La contraseña debe tener entre 12 y 128 caracteres; el nombre de usuario entre 3 y 80; el nombre visible entre 2 y 160.
- La confirmación de contraseña debe coincidir antes de llamar a la API.
- Los errores de token ausente, expirado, inválido o ya usado deben orientar a solicitar una invitación nueva.
- La activación exitosa reemplaza cualquier token local anterior, consulta `/me/profile` y aplica el enrutamiento por rol ya existente.
- No se deben registrar en consola ni persistir en archivos los tokens de invitación o de sesión.

## Enfoques considerados

### 1. Página pública con enlace prellenado — elegido

Plataforma forma un enlace `/activar?token=...`; la persona invitada lo abre en otra sesión o después de cerrar la sesión administrativa. La página activa la cuenta y abre el portal correspondiente. Es el recorrido más claro para la exposición, mantiene el modelo seguro por invitación y no requiere cambiar el backend.

### 2. Formulario alterno dentro del inicio de sesión

La persona pegaría manualmente el token en una pestaña del panel de acceso. Requiere menos navegación, pero hace más propensos los errores al trasladar un token largo y comunica peor la separación entre invitación, activación e inicio de sesión.

### 3. Activación dentro del panel de Plataforma

El administrador completaría los datos de la persona invitada. Es corto para una demostración, pero mezcla identidades, obliga a reemplazar la sesión administrativa y contradice el propósito de que la persona invitada elija su contraseña.

## Diseño de interfaz

La activación reutiliza la composición contenida del acceso actual: marca CrediCuenta, una sola tarjeta central y pie institucional. La tarjeta muestra el título `Activa tu acceso`, una explicación breve, dos campos de identidad y dos de contraseña. El único énfasis visual es el estado de invitación: lista para usar, inválida o activada.

El panel de Plataforma conserva su formulario actual. Al crear la invitación, muestra una confirmación con un campo de solo lectura que contiene el enlace y un botón `Copiar enlace`. El texto advierte que el enlace se muestra una sola vez. El token bruto no se presenta por separado.

## Flujo y estados

1. Plataforma crea la invitación para un correo, tienda y rol.
2. La web construye el enlace con `window.location.origin` y el token codificado.
3. La persona abre `/activar?token=...`.
4. Si falta el token, la página bloquea el formulario y orienta a solicitar otro enlace.
5. La persona completa nombre, usuario, contraseña y confirmación.
6. La web valida los campos y llama una sola vez a `api.activate(...)`.
7. La API invalida la invitación y devuelve el par de tokens de sesión.
8. La web guarda ambos tokens, consulta el perfil y muestra el portal asignado.
9. Si la API rechaza la activación, la página conserva los datos no sensibles, limpia las contraseñas y explica cómo continuar.

Mientras la petición está pendiente, el botón queda deshabilitado y cambia a `Activando…`, evitando envíos duplicados.

## Cambios previstos

- `apps/web/src/api/client.ts`: añadir `activate` a `ApiClient` y a `HttpApiClient` usando `POST /auth/activate`.
- `apps/web/src/app.tsx`: añadir validación, pantalla pública de activación, detección de ruta y generación/copia del enlace en Plataforma.
- `apps/web/src/styles.css`: estilos mínimos para el enlace de un solo uso y la disposición de los campos, reutilizando los tokens visuales existentes.
- `apps/web/src/app.spec.tsx`: cubrir token ausente, validación local, activación exitosa con enrutamiento por rol, error de API, bloqueo de doble envío y enlace generado desde Plataforma.

## Verificación

- Pruebas unitarias del frontend siguiendo ciclo rojo-verde-refactor.
- `npm run lint --workspace @credicuenta/web`
- `npm run typecheck --workspace @credicuenta/web`
- `npm run test --workspace @credicuenta/web`
- `npm run build --workspace @credicuenta/web`
- Revisión manual de escritorio y móvil del acceso, activación y resultado por rol.

## Decisiones del constructor

- Se usará detección directa de `window.location.pathname` porque solo existe una entrada pública adicional; introducir un router completo aumentaría el alcance sin mejorar el recorrido.
- El botón de copiado usará `navigator.clipboard.writeText` cuando esté disponible y mostrará el enlace seleccionable como respaldo.
- La estética permanecerá alineada con CrediCuenta; no se redefinirán tipografía, paleta ni estructura global para esta pantalla.
