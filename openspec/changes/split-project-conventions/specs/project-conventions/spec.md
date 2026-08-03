## REMOVED Requirements

Los diecisiete requirements de esta sección se **reubican**, no se deprecan. Ninguno pierde vigencia: cada uno se agrega textualmente idéntico a la capability que lo gobierna. El texto del requirement, sus scenarios y sus modales normativos viajan verbatim; este change no modifica el significado de ninguno.

### Requirement: Los cálculos monetarios usan aritmética decimal

**Reason**: Reubicación, no deprecación. Es una regla de dominio sobre cómo se hace aritmética con plata, no una convención de repo. Su lugar es `schema-base`, la capability que ya define el tipo `Money` sobre `decimal.js` y la escala `NUMERIC(18,2)` / `NUMERIC(18,6)`. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/schema-base/spec.md`. Quien busque la regla de aritmética decimal la encuentra ahora junto a la definición del tipo `Money`. Ver la nota de solapamiento con el requirement preexistente "Aritmética monetaria con tipo Money" en el `proposal.md` de este change.

### Requirement: El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display

**Reason**: Reubicación, no deprecación. Es una regla de dominio sobre el orden determinístico de los movimientos, no una convención de repo. Su lugar es `transactions`, la capability que gobierna los listados y las sumatorias de movimientos y desde la que `cards` y `accounts` la consumen. La regla sigue vigente sin cambios, incluida su cláusula de que aplica a todos los módulos.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/transactions/spec.md`. El requirement "Las transacciones de pago de resumen y reversión preservan el orden determinístico" de esa misma capability, que hasta ahora apuntaba a `project-conventions` para la regla general, se actualiza en este change para apuntar al requirement vecino (ver `## MODIFIED Requirements` del delta de `transactions`).

### Requirement: Las tarjetas no descuentan disponible hasta el pago del resumen

**Reason**: Reubicación, no deprecación. Es el invariante contable `I-CRED-1` de las tarjetas de crédito, no una convención de repo. Su lugar es `cards`, la capability que gobierna el ciclo de vida de las tarjetas y sus períodos. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/cards/spec.md`. Ver la nota de solapamiento con los requirements preexistentes "Las cuentas credit no descuentan saldo disponible hasta el pago del resumen" (`accounts`) y "Las transacciones de tarjeta NO impactan el saldo disponible del usuario" (`transactions`) en el `proposal.md` de este change.

### Requirement: Las cuotas N>1 usan el patrón madre/hija con la madre off-ledger

**Reason**: Reubicación, no deprecación. Es el invariante contable `I-CRED-7` de las compras en cuotas, no una convención de repo. Su lugar es `cards`, la capability que gobierna las cuotas y su imputación a períodos. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/cards/spec.md`.

### Requirement: Toda transacción en tarjeta tiene un período asignado

**Reason**: Reubicación, no deprecación. Es el invariante contable `I-CRED-6`, no una convención de repo. Su lugar es `cards`, la capability que gobierna `card_periods` y la asignación de consumos a períodos. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/cards/spec.md`.

### Requirement: Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy

**Reason**: Reubicación, no deprecación. Es el invariante contable `I-CRED-12` y la regla del rolling automático de períodos, no una convención de repo. Su lugar es `cards`. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/cards/spec.md`. Ver la nota de solapamiento con el requirement preexistente "El sistema mantiene siempre al menos un período abierto por delante de hoy" de esa misma capability en el `proposal.md` de este change.

### Requirement: Las cuotas N>1 solo aplican a transacciones en ARS

**Reason**: Reubicación, no deprecación. Es el invariante contable `I-CRED-9`, no una convención de repo. Su lugar es `cards`, junto al resto de las reglas de cuotas. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/cards/spec.md`.

### Requirement: La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS

**Reason**: Reubicación, no deprecación. Es el invariante contable `I-CRED-11` sobre una columna de `transactions`, no una convención de repo. Su lugar es `transactions`, la capability que gobierna esa tabla. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/transactions/spec.md`. Ver la nota de solapamiento con el requirement preexistente "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS" de esa misma capability en el `proposal.md` de este change.

### Requirement: Bimoneda por defecto — todo usuario arranca con ARS y USD habilitados

**Reason**: Reubicación, no deprecación. Es una regla de producto sobre el aprovisionamiento del usuario nuevo, no una convención de repo. Su lugar es `onboarding`: dos de sus tres scenarios describen pantallas del wizard (`/onboarding/perfil`, `/onboarding/saldo-actual`) y la cláusula vinculante —"el onboarding nunca pregunta «¿manejás dólares?»"— rige ahí. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/onboarding/spec.md`. El aprovisionamiento por trigger (`on_auth_user_created_default_account`) que describe su primer scenario sigue gobernado en paralelo por `accounts` ("Cuenta Efectivo por defecto en el signup"); ver el `proposal.md` para el argumento de por qué el requirement va entero a `onboarding` y no se parte.

### Requirement: Toda nueva ruta o pantalla entrega loading y error states desde su primera implementación

**Reason**: Reubicación, no deprecación. Es la regla de proceso de la capability `route-loading-and-errors` —qué obligación tiene una ruta nueva antes de mergearse— y no una convención transversal del repo. Su lugar es esa capability, que ya define los componentes `Spinner` y `RouteError` y la cobertura vigente de las rutas existentes. La regla sigue vigente sin cambios, incluida su cláusula de no retroactividad.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/route-loading-and-errors/spec.md`, donde queda junto a los requirements de cobertura ("Toda ruta de apps/web bajo (app), (auth) y (onboarding-wizard) tiene loading.tsx y error.tsx (web)" y su par mobile) que describen el estado alcanzado, mientras este describe la obligación hacia adelante.

### Requirement: El repo está organizado como monorepo pnpm con apps/ y packages/

**Reason**: Reubicación, no deprecación. Es una regla de arquitectura del repo —qué carpetas existen y qué va en cada una—, no una convención de trabajo como el idioma, el branching o el merge. Su lugar es la capability nueva `repo-architecture`, creada por este change y justificada en el `proposal.md`. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/repo-architecture/spec.md`.

### Requirement: La paridad web↔mobile se sostiene por contratos de props compartidos

**Reason**: Reubicación, no deprecación. Es la política de arquitectura web↔mobile (dos implementaciones nativas, una sola API vía `@grana/ui-contracts`, lógica pura única en `@grana/money-logic`), no una convención de trabajo. Su lugar es `repo-architecture`, junto a la layout del monorepo y a la regla de frontera `apps/`↔`packages/` que la complementan. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/repo-architecture/spec.md`.

### Requirement: La lógica isomórfica vive en el package de dominio; sólo el glue acoplado a plataforma queda por app

**Reason**: Reubicación, no deprecación. Es la regla de frontera `apps/`↔`packages/` —dónde vive cada módulo según su acoplamiento a plataforma—, es decir arquitectura del repo, no convención de trabajo. Su lugar es `repo-architecture`, donde queda contigua a la layout del monorepo que la presupone. La regla sigue vigente sin cambios, incluida la obligación sobre la prosa de `AGENTS.md`.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/repo-architecture/spec.md`.

### Requirement: Capas de componentes UI y ubicación de componentes compuestos

**Reason**: Reubicación, no deprecación. Es la regla fundacional del design system —las tres capas de componentes, su ubicación canónica por plataforma y la obligación de usar el primitivo equivalente en pantallas equivalentes—, no una convención de trabajo del repo. Su lugar es la capability nueva `ui-foundations`, creada por este change y justificada en el `proposal.md`. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/ui-foundations/spec.md`.

### Requirement: `@grana/ui-tokens` sirve sus custom properties a ambas plataformas

**Reason**: Reubicación, no deprecación. Es una regla del design system sobre los tokens de diseño y su resolución en runtime, no una convención de trabajo del repo. Su lugar es `ui-foundations`, junto a las capas de componentes que consumen esos tokens. La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/ui-foundations/spec.md`. El requirement de `page-header` que lo referenciaba ("Las pantallas de `(app)` no envuelven con SafeAreaView edges=['top'] cuando renderizan PageHeader o DashboardHeader") se actualiza en este change para apuntar a la capability nueva (ver `## MODIFIED Requirements` del delta de `page-header`).

### Requirement: Las superficies tipo tarjeta componen el primitivo `Card`, no recrean su shell

**Reason**: Reubicación, no deprecación. Es una regla de uso del design system sobre un primitivo concreto, no una convención de trabajo del repo. Su lugar es `ui-foundations`, junto a la regla de capas que la enmarca y a su gemela de acciones (`Button`). La regla sigue vigente sin cambios.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/ui-foundations/spec.md`.

### Requirement: Las acciones tipo botón componen el primitivo `Button`, no recrean su estilo

**Reason**: Reubicación, no deprecación. Es una regla de uso del design system sobre un primitivo concreto, no una convención de trabajo del repo. Su lugar es `ui-foundations`, junto a su gemela de superficies (`Card`). La regla sigue vigente sin cambios, incluidas sus excepciones acotadas.

**Migration**: Ninguna migración de código ni de datos. El requirement se agrega idéntico en `openspec/specs/ui-foundations/spec.md`. El requirement de `route-loading-and-errors` que lo referenciaba ("Las rutas bajo `/settings` adoptan Variant C de in-page chrome") se actualiza en este change para apuntar a la capability nueva (ver `## MODIFIED Requirements` del delta de `route-loading-and-errors`).
