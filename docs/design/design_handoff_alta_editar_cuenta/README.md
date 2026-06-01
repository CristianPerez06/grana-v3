# Handoff: Alta y Edición de cuenta (grana · módulo Cuentas)

## Overview
Dos pantallas del módulo **Cuentas** de grana (finanzas personales, español rioplatense):

1. **Crear cuenta** — alta de una cuenta nueva (Efectivo o Bancaria/Débito).
2. **Editar cuenta** — edición de una cuenta existente, con **tipo** y **saldo inicial bloqueados**.

Ambas son el **rediseño hi-fi** del form de alta/edición que hoy existe en la app (form plano, vertical). La dirección elegida es **drawer lateral derecho con vista previa en vivo**, idéntico al patrón ya usado en **"Alta de tarjeta"** y **"Editar tarjeta"** del módulo Tarjetas.

> **Nada de lo que muestra el form actual se pierde.** Se conservan todos los campos, textos y reglas (tipo no editable, saldo inicial no modificable, aclaraciones). Solo cambia el envoltorio visual para alinearlo al sistema.

## About the Design Files — ⚠️ usar la librería de diseño existente
Los archivos de este bundle son **referencias de diseño en HTML/CSS/JS vanilla** — prototipos que fijan el look & feel y el comportamiento, **NO código de producción para copiar literal**.

**La tarea es recrear esto en el codebase real de grana reutilizando los componentes, tokens y tipografía de la librería de diseño que ya existe.** En concreto:

- **Reutilizar el componente de drawer** ya implementado para **"Registrar movimiento" / "Alta de tarjeta" / "Editar tarjeta"**: el shell (scrim + panel 540px), `Header` (eyebrow + título + botón cerrar), `Footer` sticky (Cancelar + primario), y el scroll del body. **No crear un drawer nuevo.**
- **Reutilizar las primitivas de form de la librería**: `field-group` / `field-row`, `segmented control`, `section-label`, `hint`, y el **selector de banco/institución** (el mismo combobox con búsqueda que usa Alta de tarjeta). Si ya existe como componente, usarlo tal cual; si no, extraerlo a uno compartido.
- **Reutilizar tokens y tipografía** del design system (colores, radios, sombras, Plus Jakarta Sans). **No hardcodear** valores si ya hay variables/tokens.
- **No copiar el HTML literal**: recrear con los componentes y patrones del repo.

Si todavía no existe un componente equivalente en la librería, **crearlo como componente reutilizable** (no inline), porque estas pantallas comparten el 90% con los drawers de Tarjetas.

- **Implementación final:** `Grana - Alta de cuenta.html` y `Grana - Editar cuenta.html` (autocontenidos, en la raíz del bundle). Fuente de verdad del look & feel y las interacciones.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son finales y siguen el sistema de grana. Los datos (Galicia, Comafi, montos) son **mock**.

---

## Screens / Views

### 0. Contexto: listado de Cuentas (atenuado)
Solo contexto. El drawer se abre **encima del listado de Cuentas**. Detrás hay un **scrim** `rgba(11,26,43,.34)` con `backdrop-filter: blur(2px)`. No hace falta reconstruir el listado: ya existe.

### 1. Drawer · Crear cuenta
**Layout:** panel fijo a la derecha, **540px**, alto completo, `box-shadow: -24px 0 60px -20px rgba(11,26,43,.34)`. Columna flex: Header (`flex:none`) · Body (`flex:1; overflow-y:auto`, padding `22px 28px 28px`) · Footer (`flex:none`).
- **Header:** eyebrow "NUEVA CUENTA" (11px/700/uppercase/.15em, `--emerald-deep`) + título "Crear cuenta" (25px/800) + botón cerrar X (38×38, radio 11).
- **Footer:** "Cancelar" (ghost, `flex:none`, alto 52) + "Crear cuenta" (`flex:1`, alto 52, fondo `--navy`, sombra).

#### Body (en orden)

**A) Vista previa (live preview)**
Caption "VISTA PREVIA" + dot emerald. Tarjeta de cuenta que refleja **cómo se verá en el listado**:
- Avatar 44×44 (radio 13). **Efectivo** → fondo `--terracota-soft`, ícono billetera `--terracota`. **Bancaria** → fondo = color del banco, inicial blanca.
- Nombre + meta ("Efectivo" / "Débito · {banco}") + badge de tipo (Efectivo/Débito) a la derecha.
- Saldo: monto ARS grande; si hay USD > 0, segunda línea "US$ …".
- En estado vacío la tarjeta queda **ghost** (borde dashed, texto atenuado).

**B) Tipo de cuenta** (`section-label` "TIPO DE CUENTA")
- **Segmented control** con ícono: **Efectivo** (billetera) / **Bancaria / Débito** (banco). Selección única, default **Efectivo**.
- Al elegir **Bancaria** aparece el bloque **Banco / institución**; al volver a Efectivo, se oculta.

**C) Banco / institución** *(solo si Tipo = Bancaria)* (`section-label` "BANCO / INSTITUCIÓN")
- **Selector con búsqueda** (el mismo de Alta de tarjeta): trigger con dot + nombre + chevron; menú con search + lista de bancos. **El color de la cuenta se deriva de la institución** (no es un campo elegible).

**D) Nombre** (`section-label` "NOMBRE")
- `field-group` 1 fila: ícono (billetera en Efectivo / banco en Bancaria) + label + input inline.
- Placeholder: Efectivo → "Ej: Billetera, Caja chica"; Bancaria → "Ej: Galicia, Sueldo".
- Si se deja vacío en Bancaria, el preview usa el nombre del banco.

**E) Saldo inicial** (`section-label` "SALDO INICIAL")
- `money-group` con **dos filas editables**: **Pesos (ARS)** y **Dólares (USD)**. Ícono de moneda + label + input numérico a la derecha (`tabular-nums`, prefijo $ / US$).
- `hint`: "Es el saldo con el que arranca la cuenta hoy. Después se ajusta con tus movimientos."
- **Las dos monedas (ARS y USD) aplican a todos los tipos, incluido Efectivo** (una cuenta de efectivo puede tener dólares). Siempre mostrar ambas filas.

### 2. Drawer · Editar cuenta
Mismo shell y primitivas. Diferencias respecto del alta:
- **Header:** eyebrow = breadcrumb con flecha ← + nombre de la cuenta ("CA cOMAFI"); título "Editar cuenta".
- **Footer:** "Cancelar" + "Guardar cambios".

#### Body (en orden)
**A) Vista previa** — igual, prellenada con la cuenta actual; color e inicial salen de la institución.

**B) Tipo — BLOQUEADO** (`section-label` "TIPO")
- **Campo read-only** `locked-field`: fondo `--locked` (#EFF2F5), ícono atenuado, valor ("Bancaria / Débito") en `--muted`, **candado** a la derecha.
- `hint`: "El tipo de cuenta no se puede cambiar."

**C) Nombre — editable** — `field-group`, prellenado ("CA cOMAFI").

**D) Institución — editable** — mismo selector de banco con búsqueda, prellenado (Banco Comafi). Cambiar institución actualiza color e inicial del preview.

**E) Saldo inicial — BLOQUEADO** (`section-label` "SALDO INICIAL")
- `money-group` read-only (fondo `--locked`): filas ARS y USD mostrando los valores actuales (`$300.000,00` / `US$0,00`) con **candado**, sin inputs.
- `hint`: "El saldo inicial no se puede modificar. Registrá un ajuste cuando exista el módulo de transacciones."

---

## Interactions & Behavior
- **Apertura:** Crear → botón "Crear cuenta" del listado; Editar → desde el detalle/listado de la cuenta. Drawer entra desde la derecha; transición sugerida `.34s cubic-bezier(.32,.72,0,1)`; scrim con blur detrás.
- **Cierre:** botón X, `Esc`, o click en el scrim. Con cambios sin guardar → confirmar descarte.
- **Tipo (alta):** togglea el bloque de institución y el ícono/placeholder del nombre, y el acento del preview (Efectivo = terracota; Bancaria = color del banco).
- **Selector de banco:** búsqueda en vivo; al elegir, deriva color e inicial del avatar del preview.
- **Preview en vivo:** nombre, avatar, meta, badge y saldos se reflejan al instante.
- **Campos bloqueados (edición):** Tipo y Saldo inicial son read-only con candado; no entran al payload de guardado.
- **Guardar:** valida → persiste → cierra drawer → toast ("Cuenta creada" / "Cuenta actualizada"). Deshabilitar primario mientras haya un requerido inválido.
- No usar `scrollIntoView`.

## State Management
**Alta** (`crear`):
```
{
  tipo,            // 'efectivo' | 'bancaria'   (default 'efectivo')
  institucion,     // string | null   (requerido si tipo==='bancaria') → deriva color + inicial
  nombre,          // string (opcional en bancaria → cae al nombre del banco; recomendado en efectivo)
  saldoInicialArs, // number (default 0)
  saldoInicialUsd, // number (default 0)
  // accent: derivado de la institución (bancaria) o terracota (efectivo). NO es un campo.
  dirty
}
```
**Edición** (`editar`, prellenado):
```
{
  id,
  tipo,            // READ-ONLY (no se envía)
  institucion,     // editable (solo bancaria)
  nombre,          // editable
  saldoInicialArs, // READ-ONLY
  saldoInicialUsd, // READ-ONLY
  dirty
}
```
**Derivados que recalculan el preview:** `tipo` (→ avatar/badge/acento), `institucion` (→ color + inicial + meta), `nombre`, `saldoInicialArs`/`Usd` (→ líneas de saldo).

### Validaciones
- Si `tipo === 'bancaria'`: `institucion` requerida.
- `nombre`: requerido en Efectivo; opcional en Bancaria (cae al nombre del banco).
- Saldos: numéricos ≥ 0; vacío = 0.
- En edición no se validan ni envían `tipo` ni saldos (bloqueados).

---

## Design Tokens

### Colores
| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#F6F7F9` | fondo app / drawer |
| `--card` | `#FFFFFF` | superficies |
| `--navy` | `#0B1A2B` | texto principal, botón primario |
| `--muted` | `#6B7683` | texto secundario, valor bloqueado |
| `--soft-text` | `#8A94A3` | labels de sección |
| `--faint` | `#AEB6C0` | placeholders, sufijos, candado |
| `--border` | `#E6EAEF` | bordes |
| `--field-bg` | `#FAFBFC` | fondo de íconos / inputs |
| `--locked` | `#EFF2F5` | fondo de campos read-only (tipo, saldo en edición) |
| `--emerald` | `#10B981` | dot preview, check selector |
| `--emerald-deep` | `#0E9E6E` | eyebrow, ícono saldo USD |
| `--emerald-soft` | `#ECFDF5` | fondo ícono USD |
| `--terracota` | `#B56A5A` | acento de Efectivo, avatar/billetera |
| `--terracota-soft` | `#FBEFEA` | fondo avatar Efectivo |
| `--slate` | `#3A6B8A` | avatar usuario, ícono ARS |
| `--slate-soft` | `#EAF1F6` | fondo ícono ARS |
| `--brand` | `#15B981` | logo grana |

**Colores de acento por institución** (los asigna el backend según el banco; NO se eligen en el form): `#F4A024` Galicia, `#C9332E` Santander, `#1464A5` BBVA, `#1B4D9B` Nación/Comafi/Credicoop, `#0A4C8B` Macro, `#159A5B` Provincia/Patagonia, `#6C4BD9` Brubank, `#7A4BD9` Ualá, `#E25522` Naranja X, `#2D8FD6` Mercado Pago.

### Tipografía
- Familia: **Plus Jakarta Sans** (400/500/600/700/800).
- Título drawer 25px/800/-0.03em · eyebrow 11px/700/uppercase/.15em · section-label 11px/800/uppercase/.09em · label de campo 11px/700/uppercase · valor de campo 15px/600 · monto saldo (preview) 26px/700 · input de saldo 16px/700 · segmented 14px/700.
- `tabular-nums` en todos los montos.

### Radios
Drawer/cards 20px · field-group / money-group / locked-field / selector 15px · íconos de campo 11px · segmented 13px (botones 9px) · botones 14px.

### Sombras
- Drawer: `-24px 0 60px -20px rgba(11,26,43,.34)`.
- Botón primario: `0 8px 20px -4px rgba(11,26,43,.30)`.
- Segmented activo: `0 1px 3px rgba(11,26,43,.10)`.
- Menú selector de banco: `0 22px 54px -18px rgba(11,26,43,.38)`.

## Assets
- **Íconos:** SVG line inline (stroke ~1.9–2, round join/cap). **Reemplazar por el set de la librería** (Lucide / Feather mapean 1:1: wallet, landmark/bank, search, lock, info, check, chevron-down, chevron-left, x).
- **Tipografía:** "Plus Jakarta Sans" (o la del sistema si ya está cargada).
- Sin imágenes raster ni logos externos.

## Files
- `Grana - Alta de cuenta.html` — implementación final del alta (drawer + preview). Fuente de verdad.
- `Grana - Editar cuenta.html` — implementación final de edición (tipo + saldo bloqueados).
- `PROMPT.md` — prompt listo para pegar en Claude Code.

> El patrón de drawer, el selector de institución y los tokens son **los mismos** que el módulo Tarjetas. Ver `design_handoff_alta_tarjeta/` y `design_handoff_editar_tarjeta/` para el componente base que hay que reutilizar.
