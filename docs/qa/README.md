# QA funcional de Grana V3

Estas guías convierten las specs funcionales del repo en recorridos manuales ejecutables por QA.

## Documento canónico

**[`plan-de-pruebas.md`](./plan-de-pruebas.md)** — plan vivo, organizado **por módulo** y por
**nivel** (N1 básico → N2 intermedio → N3 avanzado/inusual). Incluye el dataset base para armar
los escenarios, una columna de **Estado** para ir marcando resultados y un registro de los fixes
que surgen del QA. Es el documento que se mantiene actualizado.

## Origen / referencia

- `instancia-01-base-funcional.md` (+ `.docx`): primer borrador hecho por Codex, dividido por
  "instancias incrementales". Sirvió de base para el plan canónico y queda como referencia.
  Nota: contemplaba escenarios que la app ya no permite (p. ej. crear una cuenta de **efectivo**
  para luego borrarla — hoy solo se crean cuentas bancarias). El plan canónico corrige esto.
- `tools/` y `_render/`: pipeline de Codex para exportar la guía a `.docx`.

## Convenciones

- La documentación QA permanece en español, igual que las specs del proyecto.
- Cada caso tiene un identificador estable (`MÓDULO-Nx-NN`) para reportar defectos.
- Las fechas financieras son fechas contables. Referencia de la suite: `2026-06-01`,
  zona `America/Argentina/Buenos_Aires`.
- Los emails usan aliases parametrizados: reemplazar `<RUN>` por un id de corrida y usar un
  inbox real que reciba aliases `+`.
