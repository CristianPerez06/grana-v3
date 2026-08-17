# Grana · Bloque Recurrente (mobile) — handoff

Bloque que se despliega al activar el chip **Recurrente** en el form de nuevo movimiento.
Reemplaza el banner verde + “¿Cada cuánto?” con 5 chips en dos filas + “Repetir hasta (opcional)”
(~250 px) por **2 rows de 38 px = 79 px**.

Referencia visual: [`recurrente-bloque-final.html`](./recurrente-bloque-final.html) (canvas con estados + spec).

> **Alcance y decisión pendiente.** Este doc define **cómo se ve** el bloque; el **qué/por qué**
> (reglas de recurrencia, generación de instancias) vive en `openspec/` y la spec `transactions`.
> Parte del rediseño del alta — ver el doc padre [`../README.md`](../README.md).
>
> ⚠️ **Cambio funcional a confirmar antes de implementar:** el diseño **quita "Anual"** de las
> frecuencias y limita las unidades del modo personalizado a **días · sem. · meses** (sin "años").
> Hoy el modelo soporta `annual` / `year` (`packages/movement-form` `Frequency`/`IntervalUnit`,
> `packages/money-logic` `RecurrenceFrequency`). Sacarlos de la UI impide crear recurrencias anuales
> desde el alta. Se debe confirmar (y decidir qué pasa con la edición de una recurrencia anual
> existente) antes de tocar código.

---

## Anatomía

```
┌──────────────────────────────────────────────────────┐
│  Semanal   Quincenal   [Mensual]   Personalizado     │  row 1 · 38 px
├──────────────────────────────────────────────────────┤
│  🗓  Repetir hasta — opcional                     ▾  │  row 2 · 38 px
└──────────────────────────────────────────────────────┘
   ⓘ Grana te lo deja listo y lo registrás con un toque. Nunca se carga solo.
```

**Row 1 — frecuencia.** Cuatro chips, selección única, default **Mensual**.
`Semanal · Quincenal · Mensual · Personalizado`. **Se quitó Anual.**

**Row 2 — hasta cuándo.** Campo con borde que abre el date picker. Opcional.

**Aviso.** El banner verde se reemplaza por una línea gris fuera de la card, que además
resume la regla en lenguaje natural (“Se repite cada 3 meses, sin fecha de fin.”).

---

## Comportamiento

| Acción | Resultado |
|---|---|
| Abrir el bloque | Mensual seleccionado, fecha vacía = se repite sin fin. |
| Tocar un chip | Selección única, sin abrir nada. |
| Tocar **Personalizado** | La row 2 se transforma en `cada [N] [días · sem. · meses]` y la fecha de fin se mueve a un botón de calendario de 34 px al final de la misma row. **El alto del bloque no cambia.** |
| Tocar **Repetir hasta** (campo o botón calendario) | Abre el date picker. El sheet incluye **Sin fecha de fin** para limpiar el valor. |
| Con fecha cargada | El campo muestra `hasta 31 dic 2026`; en modo personalizado, solo `31 dic`. |
| CTA | `Registrar gasto` **siempre al final del form**. |

---

## Especificaciones

**Contenedor**
- `background #FFFFFF`, `border 1px #E6EAEF`, `border-radius 14px`, sin sombra.
- Rows de **38 px exactos**, separador interno `1px #EEF1F4`.
- Padding de las dos rows: `0 10px`. Gap entre chips `5px`; en la row personalizada `6px`.

**Chips de frecuencia**
- `height 26px`, `radius 999px`, `padding 0 9px`, `border 1px #E6EAEF`, `font 11.5px/500`, `color #6B7683`.
- Activo: `background #E7F8F0`, `border #BFE9D6`, `color #0E9E6E`, `font-weight 600`.
- Los cuatro labels enteros miden **~305 px** sobre **323 px** útiles: no reducir el padding de la row ni agregar un quinto chip a esa fila.

**Campo de fecha**
- `height 28px`, `radius 9px`, `border 1px #E6EAEF`, `flex 1`, padding `0 9px`, gap `6px`.
- Ícono calendario `13px #3A6B8A` a la izquierda, chevron `13px #AEB6C0` a la derecha.
- Placeholder `Repetir hasta — opcional` en `#AEB6C0 / 500`; valor en `#142231 / 600`.
- Foco: `border #BFE9D6` + `box-shadow 0 0 0 2px #E7F8F0`.

**Modo personalizado**
- Label `cada` en `11.5px/400 #8C97A4`.
- Stepper: `height 26px`, `radius 8px`, botones `24×26` sobre `#F1F3F6`, valor `12.5px/600` tabular.
- Segmented de unidades: `width 150px`, ítems `flex 1`, `height 22px`, labels abreviados `días · sem. · meses` (los labels largos se recortan a este ancho).
- Botón de calendario: caja de `34px` con el mismo borde que el campo.

**Línea de aviso**
- Fuera de la card: padding `7px 4px 0`, `font 11.5px/400`, `color #8C97A4`, ícono ⓘ `13px #AEB6C0`.
- Los valores que se mencionan (fecha) van en `#142231 / 600`.

**Tipografía** — Plus Jakarta Sans
- Valores `600`, labels y claves `400/500`. **Nada en 700/800 dentro del bloque.**
- Chips y labels `11.5px`, valor del campo `12.5px`, unidades del segmented `11px`.
- Números con `font-variant-numeric: tabular-nums`.

**Tokens**
```
--ink #142231     --muted #6B7683   --soft #8C97A4    --faint #AEB6C0
--border #E6EAEF  --border-soft #EEF1F4  --field #F1F3F6
--emerald #10B981 --emerald-deep #0E9E6E  --emerald-soft #E7F8F0
--slate #3A6B8A
```

---

## Estados a implementar

1. Base — Mensual, fecha vacía.
2. Otra frecuencia elegida (Semanal / Quincenal).
3. Con fecha de fin — `hasta 31 dic 2026`.
4. Campo con foco.
5. Calendario abierto, con `Sin fecha de fin`.
6. Personalizado — `cada 3 meses`, sin fecha.
7. Personalizado con fecha — botón de calendario mostrando `31 dic`.

---

## Qué NO hacer

- No volver al banner verde de tres líneas ni al label “¿Cada cuánto?”.
- No poner “Repetir hasta (opcional)” como label separado arriba del input: va dentro del campo.
- No reincorporar **Anual**.
- No usar pesos 700/800 dentro del bloque.
- No dejar que los chips toquen el borde de la card.
- No poner el CTA dentro o antes del bloque.
