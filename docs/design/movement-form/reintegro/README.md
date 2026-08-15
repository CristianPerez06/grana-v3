# Grana · Bloque Reintegro (mobile) — handoff

Bloque que se despliega al activar el chip **Reintegro** en el form de nuevo movimiento.
Reemplaza el panel actual de 5 campos apilados (~330 px) por **2 rows de 38 px = 79 px**.

Archivo de referencia visual: [`reintegro-bloque-final.html`](./reintegro-bloque-final.html) (canvas con estados + spec).

> **Alcance: solo rediseño.** No se pierde ninguna funcionalidad activa del bloque de reintegro
> actual — en particular la **sugerencia de la cuenta de la misma entidad bancaria del medio de
> pago** (ver "Reglas de negocio" → *Tocar "Cuenta"*), la bidireccionalidad monto ↔ %, el tope y
> el estado acreditado/pendiente. Este doc solo define **cómo se ve**; el **qué/por qué** contable
> vive en `openspec/changes/` y en la spec `transactions`. Parte del rediseño del alta —
> ver el doc padre [`../README.md`](../README.md).

---

## Anatomía

```
┌───────────────────────────────────────────────┐
│  [ $ 2.000 ]   [ 30 %        tope $ 2.000 ]   │  row 1 · 38 px
├───────────────────────────────────────────────┤
│  [ Resumen | Galicia caja ahorro ▾ ]  ☐ Acreditado │  row 2 · 38 px
└───────────────────────────────────────────────┘
```

**Row 1 — monto y regla de cálculo.** Dos campos con borde propio (`h 28 · radius 9`).
- Izquierda: monto del reintegro. Ancho fijo `112 px` (entra `$ 999.999`, 6 dígitos). Editable a mano.
- Derecha: `flex 1`. `% ` a la izquierda del campo, `tope $ X` a la derecha (o `tope` / `sin tope`).

**Row 2 — destino y estado.**
- Segmented `Resumen | Cuenta` con `flex 1`. El segmento activo de cuenta muestra el nombre + chevron.
- Check `Acreditado` a la derecha, `flex none`.

---

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Destino default | **Resumen** — el resumen de la tarjeta con la que se está pagando. No se elige, no hay selector. |
| Tocar “Cuenta” | Selecciona la cuenta de **la misma entidad bancaria del medio de pago**, sin abrir nada (ahorra un tap). |
| Cambiar de cuenta | Solo al tocar el **nombre** de la cuenta. Abre el selector: primero la del mismo banco (label `mismo banco`), después el resto. Puede ser de otro banco. |
| Resumen activo | El segmento “Cuenta” muestra igual la cuenta default en gris `#AEB6C0` — preview de lo que pasaría al tocarlo. No es tocable como nombre; tocarlo cambia el destino. |
| Monto ↔ % | Bidireccional. Cargar un % calcula el monto; escribir un monto a mano borra el %. |
| Tope | Limita el monto calculado (ej. 30% de $9.000 = $2.700, con tope $2.000 el reintegro queda en $2.000). Cuando efectivamente aplicó, el texto del tope pasa a `#0E9E6E`. |
| Check `Acreditado` | Off = el reintegro queda **pendiente de confirmación**. No mostrar chip ni texto “Pendiente”. On = se registra como reintegro recibido. |
| CTA | `Registrar gasto` **siempre al final del form**, nunca entre bloques. |

---

## Especificaciones

**Contenedor**
- `background #FFFFFF`, `border 1px #E6EAEF`, `border-radius 14px`, sin sombra.
- Rows de **38 px exactos**. Separador interno `1px #EEF1F4`.
- Padding row 1: `0 10px`. Row 2: `0 12px`. Gap entre hijos: `8px`.

**Campos row 1**
- `height 28px`, `radius 9px`, `border 1px #E6EAEF`, `background #FFF`, padding `0 9px`, gap `6px`.
- Monto: `width 112px` fijo (no crece con el número). Foco: `border #BFE9D6` + `box-shadow 0 0 0 2px #E7F8F0`.
- Regla: `flex 1`, contenido con `justify-content: space-between`.

**Segmented**
- `background #F1F3F6`, `radius 9px`, `padding 2px`, `flex 1`, `min-width 0`.
- Ítems: `height 22px`, `padding 0 9px`, `radius 7px`, `font-size 11.5px`.
- Activo: `background #FFF`, `color #142231`, `font-weight 600`, `box-shadow 0 1px 2px rgba(11,26,43,.1)`.
- El segmento “Resumen” es `flex: none`; el de cuenta es `flex: 1` con el nombre en un span interno
  `flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
  **El nombre nunca debe sobresalir de la pastilla** — se trunca con `…` y el chevron queda siempre visible.

**Check**
- `18×18px`, `radius 6px`. On: `background #10B981` + tilde blanca `stroke-width 3.2`. Off: `border 1.5px #D9DEE5`.
- Label `Acreditado`, `11.5px / 500`, `#6B7683`. On: `#0E9E6E / 600`.

**Tipografía** — Plus Jakarta Sans
- Valores `600`, claves y labels `400/500`. **Nada en 700/800 dentro del bloque** (el peso alto rompe con el resto del form).
- Monto `14.5px`, `%` `13px`, claves/topes `11.5px`, labels segmented `11.5px`.
- Todos los números: `font-variant-numeric: tabular-nums`.

**Tokens usados**
```
--ink #142231     --muted #6B7683   --soft #8C97A4    --faint #AEB6C0
--border #E6EAEF  --border-soft #EEF1F4  --field #F1F3F6
--emerald #10B981 --emerald-deep #0E9E6E  --emerald-soft #E7F8F0
```

---

## Estados a implementar

1. Vacío — monto `$ 0` en `#AEB6C0`, regla `— %` + `tope`.
2. Monto a mano — monto con foco, `— %`.
3. % cargado — monto calculado, `30 %` + `tope $ X`.
4. Tope aplicado — monto limitado por el tope, texto del tope en verde.
5. Sin tope — `sin tope` en gris.
6. 6 dígitos — `$ 148.500`, el campo no cambia de ancho.
7. Destino Resumen (default) — cuenta default en gris dentro del segmento.
8. Destino Cuenta — nombre + chevron, tocable.
9. Nombre largo — truncado con `…`.
10. Acreditado on / off.

---

## Qué NO hacer

- No agregar labels arriba de los campos (`MONTO`, `% del gasto`, `Acreditar en`) — el bloque vuelve a crecer.
- No usar chips de % sugeridos en la row 1: se probó y deja sin lugar para escribir un porcentaje distinto.
- No mostrar textos de ayuda tipo “Vuelve al resumen de la Visa…” ni chips “Pendiente”.
- No poner el CTA dentro o antes del bloque.
- No permitir que el nombre de la cuenta desborde el segmento.
