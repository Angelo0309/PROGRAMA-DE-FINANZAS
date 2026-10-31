# CrediCuenta SQL Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar el esquema T-SQL, diccionario, relaciones, Mermaid y una imagen coherentes con los 16 objetos solicitados.

**Architecture:** Una definición declarativa genera SQL, diccionario y diagrama. Claves compuestas de contexto impiden vínculos entre tiendas, cuentas o monedas distintas. Las reglas financieras transaccionales se documentan sin fingir su implementación.

**Tech Stack:** SQL Server T-SQL; Python y Sharp locales para generación y revisión.

**Spec:** Texto pegado del usuario en C:/Users/Angelo/.codex/attachments/da4efeef-bfd1-4738-9e2c-d27f3bb881cf/Texto pegado.txt.

## Global Constraints
- 16 tablas dbo; identificadores BIGINT IDENTITY; sin borrados ni reemplazo de base existente.
- DECIMAL(18,2) ingresados; DECIMAL(24,12) calculados; DECIMAL(18,12) tasas.
- Diccionario y Mermaid derivados de la misma definición de esquema.
- No afirmar ejecución en un motor si solo se realiza validación estática.

## Review Focus
- FK compuestas con columnas obligatorias y tipos compatibles.
- Unicidad opcional RUC con índice filtrado.
- Condiciones nominales requieren capitalización no nula.
- Una obligación solo se cancela una vez.
- Una base existente provoca rechazo sin modificaciones.

## Tasks
- [ ] Crear comprobación que falle sin entregables: tablas, FK y tipos; relaciones Mermaid equivalentes.
- [ ] Generar modelo y archivos en output/sqlserver desde tmp/sqlserver/modelo.py.
- [ ] Ejecutar comprobaciones, revisar imagen y entregar con guía de ejecución y límites claros.
