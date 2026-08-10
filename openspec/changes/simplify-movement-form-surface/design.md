## Context

El alta de movimientos vive en un hook cross-platform (`@grana/movement-form`) que web y mobile bindean a sus acciones. Hoy expone `tab: 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'` y web lo renderiza con un `<Segmented>` de cinco opciones de igual peso (`movement-form.tsx:778`). Las secciones avanzadas (reintegro, compartido, repetir, cuotas) ya se renderizan colapsadas detrás de toggles/cards. El default de cuenta en create es `firstFor(tab)` — la primera cuenta elegible, no la última usada ni la más probable.

El principio rector ya está escrito en `AGENTS.md`: *"perfil único (sin modos de usuario); la profundidad sigue a los datos, no a un flag guardado. Un usuario que mantiene todo en la `Billetera` por defecto obtiene la experiencia simple; crear más cuentas hace aparecer la dimensión cuenta."* La lista de cuentas ya cumple esto. El formulario todavía no.

## Goals / Non-Goals

**Goals:**

- Reducir las decisiones visibles en el camino del gasto simple sin quitar ninguna capacidad.
- Derivar la simplicidad de los datos del usuario (cantidad de cuentas, contexto de origen), nunca de un flag ni de un modo.
- Mantener el hook I/O-free: cualquier dato nuevo (última cuenta usada) lo inyecta el caller.
- Paridad web/mobile por contrato: los derivados nuevos viven en el hook, no se retipean por plataforma.

**Non-Goals:**

- No se toca ninguna regla contable: balance, signo por tipo, corte temporal, off-ledger de tarjeta, `transactions.status`.
- No se agregan features (presupuestos, metas, alertas) — son otros módulos.
- No se rediseña el layout visual del drawer; solo cambia qué se muestra por defecto y el peso relativo de los tipos.
- No se cambia el modo edición: el tipo sigue inmutable y todos los campos editables siguen visibles.

## Decisions

### D1 — Tipos primarios vs secundarios, no un flag

`gasto`, `ingreso`, `transferencia` son primarios; `ajuste` y `cambio` secundarios, detrás de una affordance "Otros". La partición es **estática** (deriva de la naturaleza del tipo, no del usuario), así que vive como una constante en el hook (`PRIMARY_TABS` / `SECONDARY_TABS`) y ambas plataformas la consumen.

**Rationale.** `ajuste` corrige un saldo que se desvió y `cambio` convierte entre monedas: son operaciones de mantenimiento, no de registro diario. Bajarles el peso visual no las esconde (un tap las trae) pero limpia la decisión primaria de 5 a 3.

**Alternativa descartada.** Ocultar los secundarios según frecuencia de uso del usuario: agrega estado y un borde ("¿cuándo reaparecen?") sin beneficio claro. La partición estática es predecible.

### D2 — Ocultar la dimensión cuenta se deriva de `eligibleAccounts`

Cuando `eligibleAccounts.length === 1`, el hook expone `showAccountSelector = false` y el caller no renderiza el bloque de cuenta; la cuenta implícita es esa única. Con ≥2, se muestra como hoy.

**Rationale.** Es exactamente la regla que la lista de cuentas ya aplica, movida al formulario. Coherente con el principio single-profile. La elegibilidad ya depende del tab (`gasto` puede apuntar a crédito; el resto no), así que "una sola elegible" puede variar por tab — el derivado se recalcula por render, sin estado extra.

**Cuidado.** No confundir "una sola cuenta elegible" con "una sola cuenta". En el tab `transferencia` hacen falta ≥2 cuentas propias; si hay una sola, el flujo de transferencia ya no aplica y eso se maneja por separado (no es parte de este change).

### D3 — Preselección de cuenta: decisión de PO

Orden de preferencia propuesto para el default de `accountId` en create:

1. `preselectAccountId` (viene de una vista de cuenta) — ya existe.
2. La única elegible, si hay una sola.
3. **Última cuenta usada** por el usuario en un movimiento de ese tipo — *propuesto*.
4. Fallback: primera elegible (comportamiento actual).

El paso 3 requiere que el caller lea la última cuenta usada (una query barata: el `account_id` del movimiento más reciente del usuario) y la pase como `lastUsedAccountId`. El hook queda I/O-free.

**Decisión de PO pendiente:** ¿adoptamos "última usada" (paso 3) o alcanza con 1-2-4? "Última usada" acierta más seguido para quien tiene 2-3 cuentas, a cambio de una lectura extra y de un default menos predecible. Si el PO prefiere no agregar la query, se implementan solo 1-2-4 y el requirement de preselección se cumple igual.

### D4 — El invariante de secciones avanzadas es anti-regresión

Reintegro, compartido, repetir y cuotas ya arrancan colapsadas. Fijarlo como requirement evita que un rediseño futuro (o un merge distraído) las ponga en el camino del gasto simple. No hay cambio de código si el estado actual ya lo cumple; el valor es el test/scenario que lo pinta.

## Risks / Trade-offs

- **Descubribilidad de `ajuste`/`cambio`.** Bajarles el peso puede hacer que un usuario que los busca tarde un segundo más. Mitigación: la affordance "Otros" es visible y de un solo tap; no se esconden en un menú profundo.
- **Default menos predecible con "última usada".** Ver D3: es opt-in del PO; si molesta, se queda en "primera elegible".
- **Paridad mobile.** Todo derivado nuevo vive en el hook; si mobile no lee `showAccountSelector`/la partición, TypeScript no lo obliga (son datos, no tipos). Mitigación: el scenario de paridad y una nota en el contrato.

## Open Questions

- ¿"Otros" como pestaña extra dentro del `Segmented`, o como un link/acción aparte debajo? (UI, no contrato — se resuelve en implementación.)
- D3: adoptar o no "última cuenta usada".
