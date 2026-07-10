# Design — mobile-movement-form

## Contexto

`useMovementForm` (`@grana/movement-form`) ya es un hook cross-platform completo: 688 líneas de estado + cascadas + submit dispatcher, sin dependencias de plataforma más allá del objeto `Mutators` y la fn `translate`. La JSX vive en cada app. Web lo consume desde `apps/web/lib/transactions/components/movement-form.tsx` (~1671 líneas de JSX). Este change construye el consumer nativo (thin) + cierra la última costura no-compartida: el cuerpo de las thin mutations.

Dos decisiones estructurales dominan el change. El resto es render RN idiomático sobre primitivos ya existentes (`Drawer`, `DateField`, `MoneyAmountInput`, `Segmented`, `Switch`, `SelectableCard`, `FormField`, `FormError`, `Popover`).

## Decisión 1 — Extraer las thin mutations a `@grana/transactions-mutations` (isomórficas)

**Problema.** El submit dispatcher del hook llama 14 mutators. 3 orquestadores (`registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement`) y los helpers de sharing/reintegro ya viven en `@grana/transactions-mutations`. Las **thin** creates/updates (el `.insert({...})` de income/expense/transfer/adjustment/exchange + los updates) viven **inline en las server actions web**. Mobile necesita esa misma lógica de insert.

**Opciones.**

| | A) Extraer a `transactions-mutations` (isomórficas) | B) Reescribir wrappers a mano en mobile |
|---|---|---|
| Match de patrón | ✅ Idéntico a los orquestadores ya alojados ahí; idéntico a cómo change A extrajo el read slice | ✗ Patrón nuevo |
| Drift | Nulo — un solo cuerpo de insert por tipo | Alto — ~10 cuerpos de insert duplicados web/mobile |
| Churn web | Actions → wrappers thin (validate+auth+delegate+revalidate) | Web intacto |
| Contrato existente | El requirement ya dice "orquestadores… reciben cliente autenticado + input validado; auth y cache-invalidation quedan en el shell" — misma frontera | — |

**Elección: A.** Es el mismo movimiento mecánico que change A (extraer el read completo, web pasa a re-export/wrapper thin). Frontera idéntica a la que el spec ya fija para los orquestadores:

```
  fn(supabase /* ya autenticado */, userId, validatedInput) → { ok, id?, formError?, fieldErrors? }
       └─ NO valida (el shell ya validó con el schema @grana/validation)
       └─ NO resuelve auth (el shell ya pasó userId)
       └─ NO invalida cache (revalidatePath web / TanStack mobile — en el shell)
```

Cada plataforma envuelve con lo suyo:

```
WEB action createIncome(input):              MOBILE mutator createIncome(input):
  validate(schema, input)                       validate(schema, input)
  userId = getAuthenticatedUserId()             userId = (await supabase.auth.getUser()).id
  r = shared.createIncome(sb, userId, data)     r = shared.createIncome(sb, userId, data)
  revalidateAfterMovementMutation()             invalidateAfterMovementMutation(queryClient)
  return r                                       return r
```

`verifyActiveCurrency` (pre-check de moneda activa que hoy vive en el action web) viaja con las creates — es lógica de dominio reusable, no chrome de plataforma.

**Alcance de la extracción = completo** (las 5 creates + 5 updates), aunque la UI B-minimal sólo dispare income/expense/transfer. Igual que change A extrajo el read entero mientras la UI era A-minimal: dejar las actions web medio-thin sería peor, y las thin updates extraídas ahora dejan al change C (edición) como consumer puro. Los tests web + typecheck son el ground-truth de behavior-preservation.

## Decisión 2 — Household: espejo thin en mobile, no extracción todavía

**Problema.** El toggle "Compartir gasto" (y el split 100%-al-otro, constraint del backlog) necesita el shape `Household`. `getHousehold` ya es client-agnóstico (web lo llama `getHousehold(createClient())`) pero vive web-only en `apps/web/lib/shared/queries.ts`. Todo el resto del módulo Hogar (`/shared/*`) es web-only y está deferido.

**Elección: espejo thin en `apps/mobile/lib/shared/queries.ts`**, no extracción a package compartido. Racional:
- A diferencia de las mutations (10 fns, danzas de rollback, alto drift, contrato que ya pide compartir), `getHousehold` es **una** query de shape estable → riesgo de drift bajo.
- Crear/nombrar un `@grana/shared` para una sola función mientras **todo** el módulo Hogar sigue web-only es prematuro (regla: extraer sólo cuando la duplicación real lo justifica).
- **Trigger de extracción explícito:** cuando aterrice el módulo Hogar de mobile (gap 3 del backlog), el segundo consumer real fuerza la extracción a un package compartido — igual que la tab Movimientos forzó la extracción del read del feed en change A.

El form ya degrada solo: `household && members.length === 2 ? … : null`. Si el read falla o el hogar no tiene 2 miembros, no se muestra el toggle; el alta simple sigue funcionando.

## Decisión 3 — Scope B-minimal: cash/bank + 3 tabs

La tab **Gasto** del hook admite cuentas `credit`, lo que dispara `registerCardPurchase` / `registerInstallments` (+ reintegro-a-resumen). Para mantener B chico y sin tocar el hook, **el picker de cuentas ofrece sólo cash/bank**. Consecuencia limpia: las ramas `isCredit`/`isInstallments`/`reimbursement.target=statement` del hook quedan **inalcanzables** desde mobile — cero cambios al hook, y B.2 sólo agrega cuentas credit + la UI de cuotas/reintegro.

Tabs B-minimal: **Gasto · Ingreso · Transferencia**. Exchange y Adjustment quedan fuera de la UI (sus mutators se extraen igual). El split compartido (Gasto) **entra** — es el constraint del backlog.

```
B-minimal                          →   B.2 (aditivo, sin re-fork)
─────────────────────                  ─────────────────────────
tabs: gasto/ingreso/transferencia      + tab exchange, + tab ajuste
cuentas: cash/bank                     + cuentas credit (→ card purchase/cuotas)
campos: monto/cuenta/fecha/            + bloque reintegro
        categoría(+drill)/desc(+sug)   + bloque recurrencia
        /aviso negativo/split
```

## Decisión 4 — Superficie: ruta full-screen, no drawer

Web usa un `Drawer` lateral (desktop). Mobile ya tiene **ambos** primitivos (`Drawer` + pantallas full-screen de formulario). El precedente cercano es `accounts/new` (full-screen, `PageHeader` navy, scroll). Elegimos **full-screen `/transactions/new`** por consistencia con el alta de cuenta y porque un form con tabs + drill de categoría + split es incómodo en un bottom-sheet. El FAB navega con `router.push('/transactions/new')` (destino ya declarado en `QuickAddFab`, sólo hay que flip del flag).

## Datos que la pantalla necesita (todos ya disponibles o triviales)

| Input del hook | Fuente mobile | Estado |
|---|---|---|
| `accounts: MovementFormAccount[]` | proyección de la query de cuentas existente (filtrada a cash/bank) | proyección trivial |
| `categories: CategoryWithSubcategories[]` | `getAllCategories(userId)` (`apps/mobile/lib/categories.ts`) | ✅ existe |
| `household: Household \| null` | `getHousehold(supabase)` (espejo thin nuevo) | Decisión 2 |
| `today: Date` | `getTodayAR()` (`@grana/money-logic`) | ✅ existe |
| `translate` | `useT()` mobile (mismo catálogo `@grana/i18n-messages`) | ✅ existe |
| `mutators: Mutators` | `apps/mobile/lib/transactions/mutators.ts` (nuevo) | Decisión 1 |

## Riesgos / notas

- **Behavior-preservation web** es el riesgo principal de la Decisión 1. Mitigación: extracción mecánica + los tests web + typecheck; ningún cambio de firma pública ni de query keys.
- **`useTransition` en Hermes**: el hook usa `useState`/`useEffect`/`useTransition` — todos soportados por React 19 en RN 0.81. Sin APIs web-only en el hook.
- **i18n**: las keys de error que el hook genera (`errors.amount_positive`, `errors.category_required_short`, `reimbursement.errors.*`, etc.) ya existen en el catálogo compartido (las usa web). Verificar que las de la pantalla (labels de tabs/campos/CTA) existan o agregarlas a `es.json`/`en.json`.
- **No hay tests nuevos de negocio**: la lógica está en el hook (ya testeado en el contexto web) y en las mutations extraídas (behavior-preserving). Si `@grana/transactions-mutations` tiene suite, agregar un test de las thin creates; si no, el typecheck + los tests web cubren la extracción.
