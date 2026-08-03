# Reubicar los requirements fuera de lugar de `project-conventions`

## Why

`openspec/specs/project-conventions/spec.md` tiene 835 líneas y 27 requirements, y mezcla tres cosas sin relación entre sí:

1. **Convenciones de trabajo** — idioma, branching, commits, merge a `main`, workflow de OpenSpec.
2. **Arquitectura del repo** — layout del monorepo, frontera `apps/`↔`packages/`, política web↔mobile, capas de componentes UI.
3. **Reglas de dominio sobre plata** — aritmética decimal, off-ledger de tarjetas, períodos, cuotas madre/hija, `fx_rate_to_ars`, bimoneda por defecto.

El grupo 3 es el problema real. La regla de cómo se popula `fx_rate_to_ars` vive a tres requirements de distancia de la regla de cómo se nombra una branch. Las consecuencias son concretas y ya se están pagando:

- **Quien lee `cards` no encuentra las reglas de las tarjetas.** Cinco invariantes contables de tarjeta (`I-CRED-1`, `I-CRED-6`, `I-CRED-7`, `I-CRED-9`, `I-CRED-12`) viven en la spec de convenciones. Un LLM que abre `openspec/specs/cards/spec.md` para implementar un cambio de tarjetas no los ve.
- **Quien lee `project-conventions` para saber cómo trabajar tiene que atravesar contabilidad.** El archivo es la primera parada de una sesión nueva y hoy el 33% de su contenido no le sirve a esa pregunta.
- **Ya hay duplicación silenciosa.** Cuatro de las reglas de dominio existen hoy **dos veces**: una en `project-conventions` y otra en la capability que las gobierna, escritas por separado y sin saber una de la otra (ver "Solapamientos detectados" más abajo). Eso es exactamente el fallo que la V3 quiere evitar: la misma regla, dos textos, sin un dueño.

**Cómo pasó.** `project-conventions` era la única capability meta del proyecto. Cuando una regla no tenía un hogar obvio —o cuando su hogar todavía no existía como capability— aterrizaba acá. La spec no se degradó por descuido: funcionó como el vertedero por defecto porque era el único lugar que aceptaba cualquier cosa. Sin una regla sobre qué puede entrar a una capability de convenciones, se vuelve a llenar (ver "Seguimiento recomendado").

## What Changes

**Este change es una reubicación pura. No modifica el significado de ningún requirement.** El texto de cada requirement, sus scenarios y sus modales normativos se mueven **verbatim** —byte a byte, extraídos por script desde el spec maestro, no retipeados—. Donde detectamos que un requirement está desactualizado, duplicado o es ambiguo, lo dejamos anotado en este proposal y **no lo corregimos acá**.

Como OpenSpec no tiene una operación `MOVED`, cada reubicación se expresa como un `REMOVED` en `project-conventions` más un `ADDED` en la capability destino. Cada `REMOVED` dice explícitamente, en su `**Reason**`, que es una reubicación y no una deprecación, y nombra el destino.

### Reubicaciones — reglas de dominio (9)

| Requirement | Destino | Por qué |
| --- | --- | --- |
| Los cálculos monetarios usan aritmética decimal | `schema-base` | Es donde ya vive el tipo `Money` sobre `decimal.js` y la escala `NUMERIC(18,2)`/`(18,6)` |
| El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display | `transactions` | Gobierna listados y sumatorias de movimientos; `cards` y `accounts` la consumen desde ahí |
| Las tarjetas no descuentan disponible hasta el pago del resumen | `cards` | Invariante `I-CRED-1` / off-ledger |
| Las cuotas N>1 usan el patrón madre/hija con la madre off-ledger | `cards` | Invariante `I-CRED-7` |
| Toda transacción en tarjeta tiene un período asignado | `cards` | Invariante `I-CRED-6` |
| Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy | `cards` | Invariante `I-CRED-12` / rolling automático |
| Las cuotas N>1 solo aplican a transacciones en ARS | `cards` | Invariante `I-CRED-9` |
| La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS | `transactions` | Invariante `I-CRED-11` sobre una columna de `transactions` |
| Bimoneda por defecto — todo usuario arranca con ARS y USD habilitados | `onboarding` | Dos de sus tres scenarios son pantallas del wizard; la cláusula vinculante ("nunca preguntar «¿manejás dólares?»") rige ahí |

Sobre `fx_rate_to_ars`: la hipótesis de partida ofrecía `cards` o `schema-base`. Va a `transactions` porque la columna es de `transactions` y porque esa capability **ya tiene** su propia versión de la regla — poner las dos juntas hace visible la duplicación en vez de esconderla en dos archivos distintos.

Sobre bimoneda: `accounts` también tiene título ("Cuenta Efectivo por defecto en el signup" cubre el aprovisionamiento por trigger). El requirement no se parte porque es **una sola** regla de producto con tres brazos (signup, onboarding, opt-out en `settings`); partirla sería justamente el tipo de edición de contenido que este change se prohíbe. Va entero a `onboarding`, que es donde vive su cláusula vinculante.

### Reubicaciones — borderline resueltos (8)

| Requirement | Destino | Decisión |
| --- | --- | --- |
| Toda nueva ruta o pantalla entrega loading y error states desde su primera implementación | `route-loading-and-errors` | **Se mueve.** No hay duplicación: los requirements existentes de esa capability describen la *cobertura alcanzada* de las rutas actuales; este describe la *obligación hacia adelante*. Son complementarios y se leen mejor juntos |
| El repo está organizado como monorepo pnpm con apps/ y packages/ | `repo-architecture` (nueva) | Arquitectura, no convención de trabajo |
| La paridad web↔mobile se sostiene por contratos de props compartidos | `repo-architecture` (nueva) | Arquitectura: es la política de dos implementaciones + una API |
| La lógica isomórfica vive en el package de dominio | `repo-architecture` (nueva) | Arquitectura: es la regla de frontera `apps/`↔`packages/` |
| Capas de componentes UI y ubicación de componentes compuestos | `ui-foundations` (nueva) | Design system |
| `@grana/ui-tokens` sirve sus custom properties a ambas plataformas | `ui-foundations` (nueva) | Design system |
| Las superficies tipo tarjeta componen el primitivo `Card` | `ui-foundations` (nueva) | Design system |
| Las acciones tipo botón componen el primitivo `Button` | `ui-foundations` (nueva) | Design system |

### Lo que queda en `project-conventions` (10)

Repo-como-memoria, documentación en español, código en inglés, commits en inglés, naming de branches, prerequisito de pnpm en el README, la cláusula de branch naming en `AGENTS.md`, la convención de specs cross-platform, el archive antes del merge, y el squash-merge sobre historia lineal.

Es una capability coherente: **cómo se trabaja en este repo**. Un colaborador nuevo la lee entera y sabe cómo escribir, nombrar, commitear, especificar y mergear. Nada de eso requiere saber contabilidad ni conocer el design system.

### Reparación de punteros (3 `MODIFIED`)

Tres requirements de otras capabilities apuntan hoy a `project-conventions` para una regla que este change se lleva. Si no se tocan, el change **introduce** tres punteros colgados. Se corrigen acá porque el defecto lo crea esta misma reubicación:

| Capability | Requirement | Cambio |
| --- | --- | --- |
| `transactions` | Las transacciones de pago de resumen y reversión preservan el orden determinístico | `(ver `project-conventions`)` → `(ver el requirement "El ordenamiento de transacciones…" de esta misma capability)` |
| `route-loading-and-errors` | Las rutas bajo `/settings` adoptan Variant C de in-page chrome | "ya está specceada en `project-conventions`" → "ya está specceada en `ui-foundations`" |
| `page-header` | Las pantallas de `(app)` no envuelven con SafeAreaView edges=['top']… | "(ver capacidad `project-conventions`)" → "(ver capacidad `ui-foundations`)" |

**Es el único texto que este change edita, y en los tres casos el edit es la referencia y nada más.** Ninguna cláusula normativa, ningún scenario y ningún modal cambian. Se declara explícitamente porque la regla de este change es "todo se mueve verbatim" y estas tres son la excepción acotada.

Un cuarto puntero, en `mobile-app-shell` ("la regla «código en inglés» definida en `project-conventions`"), **no se toca**: esa regla se queda en `project-conventions`.

## Capabilities

### New Capabilities

- **`repo-architecture`** — cómo está carveado el monorepo y dónde vive cada cosa: layout `apps/`/`packages/`, la frontera decidida por acoplamiento a plataforma, y la política web↔mobile de dos implementaciones nativas con contratos de props compartidos. 3 requirements.
- **`ui-foundations`** — la base del design system: las tres capas de componentes y su ubicación canónica por plataforma, los tokens de `@grana/ui-tokens` y su resolución en ambas plataformas, y las dos reglas de composición de los primitivos base (`Card` para superficies, `Button` para acciones). 4 requirements.

**Por qué dos capabilities nuevas y no una.** La restricción del proyecto es preferir una capability existente antes que crear una. Se evaluaron los candidatos existentes y ninguno sirve:

- `overlay-primitives` cubre primitivos **de overlay** (`Drawer`, `Popover`, `Segmented`, `Switch`, `Dialog`, `DropdownMenu`). `Card` y `Button` no son overlays; meterlos ahí rompe el criterio de esa capability.
- `page-header` es una capability de **un** componente. No es un hogar para reglas del sistema entero.
- `web-responsive-layout`, `web-app-shell` y `mobile-app-shell` son de plataforma; estas reglas son cross-platform y llevarlas ahí las partiría en dos.

Y no se juntan en una sola capability nueva porque son **dos preguntas de lectores distintos**. "¿Esto va en `packages/` o en `apps/web/lib/`?" y "¿puedo tipear `rounded-2xl border bg-card` inline?" no se responden en el mismo lugar. Fusionarlas reproduciría a menor escala exactamente el grab-bag que este change desarma. Ambos nombres son platform-neutral y sin prefijo, como manda la convención de specs cross-platform que se queda en `project-conventions`.

### Modified Capabilities

- **`project-conventions`**: 17 `REMOVED` (todos reubicaciones). Queda con 10 requirements y un `Purpose` reescrito.
- **`cards`**: 5 `ADDED` — los invariantes `I-CRED-1`, `I-CRED-6`, `I-CRED-7`, `I-CRED-9`, `I-CRED-12`.
- **`transactions`**: 2 `ADDED` (ordenamiento determinístico, `fx_rate_to_ars`) + 1 `MODIFIED` (reparación de puntero).
- **`schema-base`**: 1 `ADDED` (aritmética decimal).
- **`onboarding`**: 1 `ADDED` (bimoneda por defecto).
- **`route-loading-and-errors`**: 1 `ADDED` (loading/error en rutas nuevas) + 1 `MODIFIED` (reparación de puntero).
- **`page-header`**: 1 `MODIFIED` (reparación de puntero).

## Verificación aritmética

El spec maestro tiene **27** requirements (contados por `grep -c '^### Requirement:'`). Cada uno está en exactamente una de dos categorías:

```
  27  requirements en openspec/specs/project-conventions/spec.md
- 17  REMOVED (reubicados)
= 10  se quedan
```

Y los 17 reubicados se reparten así:

```
   5  → cards
   2  → transactions
   1  → schema-base
   1  → onboarding
   1  → route-loading-and-errors
   3  → repo-architecture  (nueva)
   4  → ui-foundations     (nueva)
  ──
  17  ADDED
```

`17 REMOVED = 17 ADDED`, y `17 + 10 = 27`. La clasificación se hace por título en un script que **falla ruidosamente** si algún requirement del spec queda sin clasificar o si un título no existe — no hay forma de que uno se pierda en silencio. Los `MODIFIED` (3) no entran en esta cuenta: no son requirements de `project-conventions`, son reparaciones de punteros en otras capabilities.

## Solapamientos detectados — NO se resuelven en este change

Al clasificar aparecieron **cuatro pares** donde la capability destino ya tiene su propia versión de la regla que se está reubicando. Los dos textos se escribieron por separado y ninguno menciona al otro:

| Requirement reubicado | Ya existe en el destino | Relación |
| --- | --- | --- |
| Los cálculos monetarios usan aritmética decimal | `schema-base` → "Aritmética monetaria con tipo Money" | Casi idénticos. El de `project-conventions` agrega el detalle del borde de UI/API y la auditoría del baseline |
| La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS | `transactions` → "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS" | Prácticamente el mismo requirement con distinto título. Mismo predicado, mismos tres scenarios |
| Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy | `cards` → "El sistema mantiene siempre al menos un período abierto por delante de hoy" | Misma regla. El de `cards` es más preciso (exige `is_estimated=true`, cubre la race condition) |
| Las tarjetas no descuentan disponible hasta el pago del resumen | `accounts` → "Las cuentas credit no descuentan saldo disponible hasta el pago del resumen" **y** `transactions` → "Las transacciones de tarjeta NO impactan el saldo disponible del usuario" | **Triple.** Ya eran dos antes de este change; con la reubicación quedan tres textos de la misma regla |

**Se reubican igual, verbatim.** La instrucción de este change es no cambiar significado, y elegir cuál de dos textos sobrevive —o fusionarlos— es una decisión de contenido con riesgo real de perder una cláusula. Lo que este change sí logra es **poner los duplicados en el mismo archivo**, donde son imposibles de ignorar: hoy están repartidos en dos specs y nadie los ve juntos.

Seguimiento recomendado: una change `dedupe-relocated-invariants` que, capability por capability, decida qué texto queda y qué cláusulas del otro hay que absorber antes de borrarlo.

## Deuda detectada — anotada, NO corregida acá

Al leer los 27 requirements aparecieron estos problemas de contenido. Ninguno se toca en este change:

1. **"Bimoneda por defecto" referencia rutas que no existen y viola la regla de código en inglés.** Nombra `/onboarding/perfil` y `/onboarding/saldo-actual`. Las rutas reales son `/onboarding/welcome`, `/onboarding/initial-balance` y `/onboarding/done` (web) y sus equivalentes en `apps/mobile/app/(onboarding)/`. Además, los segmentos en español contradicen el requirement "El código debe estar en inglés", que cubre explícitamente los segmentos de ruta. Peor: el scenario "Cuenta bancaria creada en onboarding tiene ambas monedas" describe una pantalla de perfil que la change archivada `remove-user-modes` eliminó, y otro scenario dice "según el modo" cuando los modos de usuario ya no existen. **Este requirement necesita un pase de corrección, no sólo una mudanza.**
2. **El requirement de layout del monorepo está desactualizado.** Dice "La app actual es `apps/web/`" y habla de `apps/mobile/` como algo futuro ("cuando se haga el scaffold de la app móvil"); `apps/mobile/` existe hace meses. Y enumera cuatro paquetes (`validation`, `i18n-messages`, `supabase`, `ui-tokens`) cuando hoy hay catorce.
3. **Dos requirements que se mudan a capabilities distintas se contradicen sobre dónde viven los primitivos mobile.** El de paridad web↔mobile dice `apps/mobile/components/`; el de capas de componentes dice `apps/mobile/components/ui/`. El correcto es `ui/` (es lo que hay en el repo). Al separarse en `repo-architecture` y `ui-foundations`, la contradicción queda en dos archivos distintos — conviene resolverla pronto.
4. **El invariante de período abierto está redactado con una alternativa que lo debilita.** "SHALL existir al menos un `card_periods` cuyo estado derivado sea `open` **o, alternativamente**, SHALL existir un período «actual» […] y la app SHALL haber generado el siguiente bajo demanda". Dos condiciones unidas por "alternativamente" hacen que el invariante no sea verificable. La versión de `cards` no tiene esa ambigüedad.
5. **`AGENTS.md` enumera las capabilities cross-cutting y no incluirá las nuevas.** La línea "Cross-cutting modules (`schema-base`, `profiles`, `i18n`, `card-networks`, `project-conventions`)" necesita mencionar `repo-architecture` y `ui-foundations`. Esto sí se hace en este change, en el paso de archivado (es sincronización obligatoria del checklist, no edición de requirements).

## Seguimiento recomendado — la regla que evita que se vuelva a llenar

Este change desarma el grab-bag pero **no impide que se rearme**. La causa —"`project-conventions` era el único lugar que aceptaba cualquier cosa"— sigue vigente: mañana aparece una regla sin hogar obvio y el camino de menor resistencia vuelve a ser el mismo archivo.

Recomendamos una change siguiente que agregue a `project-conventions` un requirement de admisión, con la forma:

> Un requirement SHALL entrar a `project-conventions` sólo si su sujeto es **el proceso de trabajo sobre el repo** (idioma, control de versiones, workflow de specs, merge). Un requirement cuyo sujeto sea el **dominio del producto** (plata, cuentas, tarjetas, fechas contables), la **arquitectura del código** (dónde vive un módulo) o el **design system** (qué componente componer) SHALL vivir en la capability de ese dominio, aunque todavía no exista — en cuyo caso SHALL crearse. La ausencia de un hogar obvio NO SHALL ser razón para agregarlo a una capability meta.

No se incluye en este change por dos motivos: es un requirement **nuevo** (no una reubicación) y este change se comprometió a no agregar contenido normativo; y merece su propia discusión, porque también aplica a `repo-architecture` y `ui-foundations`, que nacen hoy con el mismo riesgo.

## Impact

- **Código**: ninguno. Este change es exclusivamente de specs. No toca `apps/`, `packages/`, `supabase/migrations/` ni tests.
- **Datos**: ninguno. No hay migraciones.
- **Specs**: 9 capabilities tocadas — 1 con `REMOVED` (`project-conventions`), 5 con `ADDED` sobre capabilities existentes (`cards`, `transactions`, `schema-base`, `onboarding`, `route-loading-and-errors`), 2 nuevas (`repo-architecture`, `ui-foundations`) y 3 con `MODIFIED` de reparación de punteros (`transactions`, `route-loading-and-errors`, `page-header`).
- **`AGENTS.md`**: se actualiza en el archivado (lista de módulos cross-cutting).
- **Riesgo**: bajo en significado —el texto viaja verbatim, extraído por script— y medio en **conflicto de merge**: los archivos destino son grandes y activos. Ver la nota de solapamiento con la change activa abajo.

### Solapamiento con change activa — `cards-mobile-density`

El pre-change check de `AGENTS.md` exige verificar que ninguna otra change activa toque las mismas capabilities. **Hay una: `cards-mobile-density` toca `cards`.**

No hay conflicto semántico: esa change modifica requirements de presentación del listado (`El listado de tarjetas se muestra como wallet…`), y ésta agrega cinco requirements contables nuevos al final de la capability. No hay ningún requirement en común.

**Orden propuesto: `cards-mobile-density` primero, `split-project-conventions` después.** `cards-mobile-density` está más avanzada y su delta es `MODIFIED` sobre requirements existentes; los `ADDED` de este change son apéndices y se reaplican sin fricción sobre cualquier estado de `cards`. Si el orden se invierte, tampoco se rompe nada — sólo hay que rebasear.
