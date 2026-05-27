## Context

Las cuentas `cash`/`bank` en V3 se listan como nombre + saldos, sin avatar. El branding por institución (`institutions.brand_color`, `institutions.icon_type ∈ {'bank','wallet'}`) ya existe en DB pero no se renderiza en cuentas (solo se muestra el nombre del banco como badge de texto). La app ya usa `lucide-react` (v1.16.0) en web y tiene un precedente de paleta curada como tokens (`--cat-1..--cat-5` para categorías). Los colores semánticos de marca están fijados: `emerald` = positivo/ingreso, `terracotta` = negativo, `warning` = ámbar — el color de identidad NO puede pisarlos.

Restricciones del repo relevantes:
- **Web ↔ Mobile policy**: JSX no se comparte; los contratos de props sí (`@grana/ui-contracts`). Lógica pura cross-platform vive en `packages/`.
- **Supabase online-only**: la migración se aplica pegando SQL en el dashboard; los tipos se regeneran con `supabase gen types`.
- **Migrations son la verdad del schema**: no hay `schema.sql`.
- **`accounts` es tabla compartida** por `cash`, `bank` y `credit` (tarjetas). Las tarjetas tienen su propio branding de red y su propia capability.

## Goals / Non-Goals

**Goals:**
- Dar a cada cuenta `cash`/`bank` un avatar (color + ícono) coherente, con fallback a monograma.
- Aprovechar el `brand_color`/`icon_type` de institución que hoy se desaprovecha.
- Resolver de forma idéntica el avatar en web y mobile desde una sola fuente de verdad (keys + tokens).
- Construir `AccountAvatar` web + mobile como primer ladrillo de paridad mobile.
- Corregir el Drift A del spec de `accounts` (lista = solo cash + bank).

**Non-Goals:**
- NO construir la lista/detalle de cuentas en mobile (solo el componente `AccountAvatar`).
- NO definir el avatar de las tarjetas (`type='credit'`) — eso lo decide la capability `cards`.
- NO mostrar el avatar dentro de los pickers de cuenta de los formularios de transacción/transferencia: el control es un `<select>` nativo (un `<option>` no renderiza SVG ni color de fondo). El picker rico con avatares requiere un dropdown custom accesible y se difiere a un change posterior.
- NO color-picker libre ni emoji (descartados; ver Decisions).
- NO reintroducir el modelo "función operativa/ahorro/mixta" de v2 (eso es competencia del módulo `savings`).

## Decisions

### D1 — Avatar = `color_key` + `icon_key`, ambos nullable, con cadena de fallback

Dos columnas en `accounts`: `color_key text NULL`, `icon_key text NULL`. La regla unificadora: **`NULL` significa "derivar automáticamente"; un valor explícito significa "elección del usuario" (override fijo)**.

Cadena de resolución (pura):

```
resolveAccountAvatar(account, institution?) → { color, icon | null, monogram }

color:
  account.color_key ?? deriveColor(account, institution)
icon:
  account.icon_key  ?? deriveIcon(account, institution)
monogram:
  primera letra de account.name (fallback visual si icon resuelto es null)

deriveColor(bank)  = mapInstitutionColor(institution.brand_color)  // herencia viva
deriveColor(cash)  = palette[ hash(account.id) % palette.length ]   // determinístico
deriveIcon(bank)   = institution.icon_type === 'bank' ? 'landmark' : 'wallet'
deriveIcon(cash)   = 'wallet'
```

**Por qué `NULL = auto`**: un solo campo nullable expresa "heredar/auto" vs "override" sin un flag extra. Si el usuario cambia la institución de un banco que nunca tocó el color, el avatar sigue al nuevo banco (herencia viva). Si lo overrideó, queda fijo. Consecuencia importante: **no se necesita backfill de valores ni tocar el trigger de signup** — las filas existentes y la cuenta "Efectivo" quedan en `NULL` y el resolver las pinta bien. (Esto simplifica respecto a la mención de "default en trigger" del proposal.)

_Alternativa descartada_: columna `avatar_source` enum + valor. Más estado, más rutas, sin beneficio.

### D2 — Storage como keys, no como valores (hex / nombre de ícono)

`color_key` referencia la paleta curada; `icon_key` referencia el set curado. **No se guarda hex ni el nombre crudo del componente lucide.** Esto permite resolver el mismo key a un CSS var en web y a un valor de token en mobile, y cambiar la paleta sin migrar datos.

### D3 — Paleta curada (no color-picker libre)

~8 colores como tokens nuevos `--account-<key>` en `@grana/ui-tokens`. Razones: (a) evitar colisión con `emerald` (ingreso) y `terracotta`/`error` (negativo) — un verde elegido a mano confundiría estado con identidad; (b) contraste garantizado para el glifo blanco; (c) coherencia de marca; (d) sigue el precedente `--cat-N`. Hexes a afinar por diseño; la regla dura es **distinguibles entre sí y lejos de los semánticos**.

_Colisión con la paleta de categorías_: en una fila de transacción pueden convivir avatar-de-cuenta y color-de-categoría. Las dos paletas se afinan en conjunto para no pisarse (open question OQ2).

### D4 — Set curado de íconos lucide (no emoji, no set libre)

~16 íconos, todos verificados en lucide 1.16.0: `wallet, banknote, piggy-bank, coins, vault, briefcase, dollar-sign, landmark, credit-card, building-2, house, car, plane, graduation-cap, gift, hand-coins`. Se descartó emoji por render inconsistente entre OS y menor pulido. `icon_key` es un string union cerrado.

### D5 — Ubicación del registry + resolver

- **`@grana/ui-tokens`**: define los CSS vars `--account-<key>` (web) y expone los valores de color por key (consumo mobile).
- **`@grana/ui-contracts`**: type unions `AccountColorKey` y `AccountIconKey`, `AccountAvatarProps`, y el resolver **puro** `resolveAccountAvatar(...)` (combina campos de cuenta + institución + fallback). Vive acá por su acoplamiento directo al contract y para evitar el wiring de un paquete nuevo.
- **Por-app (`AccountAvatar`)**: cada plataforma mapea `iconKey → componente lucide` (`lucide-react` en web, `lucide-react-native` en mobile) y `colorKey → fondo` (clase con CSS var en web; valor de token en mobile). El mapa key→componente NO se comparte porque los imports de lucide difieren por plataforma; **solo el key (string) se comparte**.

_Alternativa considerada_: paquete dedicado `@grana/account-identity`. Más limpio conceptualmente pero agrega wiring (`transpilePackages` + `paths`). Se puede promover más adelante si el registry crece.

### D6 — `AccountAvatar` con dos implementaciones y un contract

`AccountAvatarProps` = `ResolvedAccountAvatar & { size?, className? }`, con `ResolvedAccountAvatar = { colorKey, colorOverride, iconKey, monogram }` — props ya resueltas (el resolver corre antes, server-side), de modo que el componente es tonto y solo pinta. El color se expresa como **uno de dos**: `colorKey` (color curado de la paleta, vía token) **o** `colorOverride` (un hex crudo de `institutions.brand_color`, fuera de la paleta); exactamente uno es no-nulo. Web: `colorKey` → utilidad `bg-account-<key>`, `colorOverride` → `style` inline. Mobile: `colorKey` → valor de `@grana/ui-tokens/tokens`, `colorOverride` → el hex directo. Así el resolver NO duplica hexes. Implementaciones separadas web (HTML + `lucide-react`) y mobile (RN + `lucide-react-native`). Tamaños: `sm` (lista/picker), `md` (detalle/hero).

### D7 — Auto-color determinístico computado, no persistido

Para `cash` sin `color_key`, el color sale de `hash(account.id) % paletteSize` en el resolver, **no se persiste**. Evita write-path y backfill; el color es estable mientras el algoritmo no cambie. El form de alta muestra un preview "auto" y solo persiste si el usuario elige explícitamente.

## Risks / Trade-offs

- **Mobile no tiene librería de íconos confirmada** → verificar y agregar `lucide-react-native` (o equivalente con los mismos nombres) en tasks antes de implementar `AccountAvatar` mobile. Si la versión no tiene algún ícono del set, ajustar el set a la intersección disponible web+mobile.
- **Drift entre CSS vars de ui-tokens y el union de keys en ui-contracts** → mitigar con una única lista canónica de keys (en ui-contracts) y un test/CI que verifique que cada key tiene su `--account-<key>` en theme.css.
- **Colisión visual paleta cuentas ↔ categorías** → afinar ambas paletas juntas (OQ2).
- **Cambiar el algoritmo de auto-color reshufflea** los colores de cuentas cash sin override → congelar el algoritmo; es un cambio cosmético de bajo daño si alguna vez ocurre.
- **`accounts` compartida con credit** → las columnas existirán para tarjetas; el resolver de cuentas se limita a cash/bank y la capability `cards` decide su propio avatar. No tocar el render de tarjetas en este change.

## Migration Plan

1. Migración SQL: `ALTER TABLE accounts ADD COLUMN color_key text, ADD COLUMN icon_key text;` (ambas NULL, sin default). Sin backfill de valores (NULL = auto). Aplicar pegando en el SQL Editor del proyecto Supabase online.
2. Regenerar `packages/supabase/src/types.ts` con `supabase gen types typescript --project-id <id>`.
3. Tokens + contracts + componentes + render + forms (orden en tasks.md).
4. **Rollback**: `ALTER TABLE accounts DROP COLUMN color_key, DROP COLUMN icon_key;` — no hay datos derivados que recuperar.

## Open Questions

- **OQ1** — ¿`resolveAccountAvatar` se ejecuta en el server (queries que ya hidratan `AccountWithBalances`) o en el caller cliente? Lean: en las queries/tipos, así `AccountAvatar` recibe props ya resueltas y mobile/web no duplican lógica de fallback.
- **OQ2** — Hexes finales de la paleta `--account-*` y su afinado conjunto con `--cat-N` (decisión de diseño visual).
- **OQ3** — Librería de íconos exacta en mobile y su paridad de nombres con el set elegido.
