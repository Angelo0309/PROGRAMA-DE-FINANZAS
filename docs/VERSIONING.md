# Flujo Git y versiones

- `main`: entregas estables; solo pull requests con al menos una aprobacion.
- `develop`: integracion de los hitos.
- `feature/*`, `fix/*`, `docs/*`: trabajo de corta duracion.
- Commits convencionales: `feat:`, `fix:`, `test:`, `docs:` y `chore:`.
- Versiones SemVer y cambios visibles en `CHANGELOG.md`.

Antes de integrar:

1. Actualizar la rama desde `develop`.
2. Ejecutar lint, tipos, pruebas y build.
3. Abrir pull request, revisar GitHub Actions y solicitar una aprobacion.
4. Integrar sin reescribir el historial compartido.

Este repositorio no configura automaticamente la proteccion remota: el dueño
debe activarla en GitHub, en **Settings → Branches → Add branch protection
rule**, para `main`.
