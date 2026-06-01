# Prompt para Claude Code

Copiá y pegá esto en Claude Code, **desde la raíz del repo de grana**, con la carpeta `design_handoff_editar_tarjeta/` disponible.

---

Estoy sumando la pantalla **"Editar tarjeta"** al módulo de Tarjetas de grana (app de finanzas personales, español rioplatense). En `design_handoff_editar_tarjeta/` tenés el handoff completo:

- `README.md` — spec detallada (layout, campos, tokens, validaciones, estado, regla archivar/eliminar). **Leelo entero primero.**
- `Grana - Editar tarjeta.html` — el prototipo final, fuente de verdad del look & feel y las interacciones. Abrilo en el navegador para ver el comportamiento (preview en vivo, checkbox de ciclo, chips, estado deshabilitado de eliminar).
- `referencia/` — la exploración de las 3 direcciones; solo contexto, NO implementar.

Antes de escribir código:
1. Leé el README y revisá el HTML final.
2. Explorá el codebase y decime **qué framework/patrones** usa (React/Vue/etc.), **si ya existe el drawer de "Registrar movimiento"** (este form debe reutilizar ese mismo componente de drawer: header, filas de campo, segmented, footer sticky, scrim) y qué design tokens/librería de UI hay.
3. Proponé un plan de implementación y esperá mi OK antes de codear.

Requisitos clave (no negociables, están en el README):
- Es **edición** de una tarjeta existente, en un **drawer lateral derecho** sobre el detalle, reutilizando el patrón de "Registrar movimiento".
- **Vista previa en vivo** arriba del form: refleja nombre, inicial (derivada del banco), red, mini-diagrama cierre→vence y límite mientras se edita.
- Campos: nombre, banco, **red/marca como chips** (Visa, Mastercard, American Express, Cabal, Naranja, Maestro, Otra), ciclo, moneda (ARS/USD), **límite opcional (campo plano, NO toggle)**.
- **El color de acento NO es un campo**: lo define el backend según la institución.
- **Ciclo:** checkbox "Cierra y vence el mismo día todos los meses" (tildado por default). Si se destilda, se ocultan los días fijos (los días cambian por resumen).
- **Acciones:** Archivar (suave, conserva historial) y Eliminar. **Eliminar SOLO habilitado si la tarjeta no tiene/tuvo movimientos**; si tiene movimientos, queda deshabilitado y se ofrece Archivar.
- Reutilizá los **componentes, tokens y tipografía existentes** del codebase; no hardcodees estilos si ya hay un design system. No copies el HTML literal: recrealo con los patrones del repo.

Implementá la UI con datos mock primero (cableá el estado y las validaciones del README); dejá los handlers de persistencia/backend como `TODO` claros para conectar después.

---

**Tip:** si querés que primero solo te explique el plan sin tocar nada, agregá al final: "Por ahora no escribas código, solo el plan."
