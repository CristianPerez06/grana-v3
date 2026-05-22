## Context

Este pit-stop ataca tres tipos de deuda detectados en la auditoría de Grana V3:

1. **Drift documental**: `CLAUDE.md`, specs maestros y `README.md` dejaron de reflejar la realidad del código. 10 de 14 specs tienen `Purpose: TBD`, la tabla "Modules" de `CLAUDE.md` está atrasada varios módulos, y la existencia de `apps/mobile` no está documentada.
2. **Hábito de proceso roto**: el paso "Update Purpose after archive" del flujo openspec no se está ejecutando. No es un error puntual; es el mismo error repetido en 10 archives.
3. **Falta de capa compartida web↔mobile**, justo antes del trabajo que va a llevar todas las features al app mobile.

Las decisiones de abajo están consensuadas en la conversación que originó esta change y se capturan acá para que cualquier sesión futura (humana o IA) las herede sin volver a discutirlas.

## Goals / Non-Goals

**Goals:**

- Restablecer `openspec/specs/` y `CLAUDE.md` como fuente de verdad alineada con el código real.
- Definir un workflow que evite que el drift vuelva a ocurrir (regla escrita + check automático).
- Arreglar el bug financiero `new Date()` antes de que cause un movimiento mal fechado en producción.
- Crear la capa compartida mínima (tipos UI + cálculos financieros puros) que el trabajo mobile va a necesitar.

**Non-Goals:**

- No refactorizar las implementaciones de los componentes UI. Se mantienen dos implementaciones nativas paralelas.
- No adoptar `react-native-web`, Tamagui, Solito ni ningún sistema cross-platform. Decisión explícita: dos implementaciones, una API.
- No reescribir el sistema openspec ni sus skills. Se respeta el formato existente.
- No tocar migraciones existentes ni el schema de DB.
- No agregar tests generales de invariantes contables en este pit-stop (van a P1). Se agrega solo el test del bug del `new Date()` que es directamente correctivo.
- No internacionalizar `getTodayAR()` ahora. Eso entra cuando se introduzca soporte multi-timezone como feature.

## Decisions

### Decision 1: Archive en la misma branch, antes del merge a main

El archive de una change SHALL ocurrir como último commit de la branch de trabajo, **antes** del merge `--ff-only` a `main`.

**Reason:** Mantiene el merge atómico: en una sola commit, `main` recibe código + spec maestro actualizado + `Purpose` completado + `CLAUDE.md` sincronizado. Evita el patrón observado de "change mergeada pero no archivada" que produjo los 10 `Purpose: TBD` actuales.

**Alternativa considerada:** archivar después del merge a `main`, con argumento de "el spec no es verdad de `main` hasta que `main` lo contenga". Rechazada porque en la práctica genera deuda diferida que nadie completa.

### Decision 2: Política web↔mobile = dos implementaciones, una API

`apps/web/components/ui/<X>.tsx` y `apps/mobile/components/<X>.tsx` mantienen implementaciones nativas separadas (no se puede compartir JSX entre web y React Native sin una capa cross-platform). La paridad entre ambas se garantiza por **tipos de props compartidos** vivos en `@grana/ui-contracts`.

**Reason:** React Native no acepta primitivos web (`<div>`, `<span>`); compartir el JSX requiere `react-native-web` u otro framework cross-platform. Esa decisión cambia el paradigma del repo y se descarta hoy. La opción intermedia "compartir solo los contratos" da la mayor parte del beneficio (TypeScript falla si las APIs divergen) sin tocar implementaciones.

**Naming convention adoptada:** Se unifica `onPress` (RN-friendly) para callbacks de interacción en lugar de `onClick`. Idem para nombres de variantes, sizes y demás props. Documentado en `packages/ui-contracts/README.md`.

### Decision 3: `@grana/money-logic` para lógica pura, queries siguen en apps

Solo migran al package las funciones **puras**: sin Supabase, sin Next, sin fetch, sin React. Concretamente: cálculo de balance a partir de una lista de transacciones, derivación de fechas de período a partir de fechas de cierre, generación de fechas futuras de una recurrencia, normalizadores y mappers.

Las **queries** (que hablan con Supabase) siguen en `apps/web/lib/` y eventualmente `apps/mobile/lib/`, porque dependen del cliente Supabase de cada app.

**Reason:** Mantiene el package 100% portable y testeable sin DB. Mobile podrá tener sus propias queries que llamen a las mismas funciones puras, garantizando idéntico resultado en ambas plataformas. Si la lógica de queries se compartiera, las dos apps tendrían que coincidir también en cómo construyen su cliente Supabase, lo cual es más fricción que beneficio hoy.

### Decision 4: `getTodayAR()` se mantiene AR-only por ahora

El fix reemplaza `new Date().toISOString()` por `formatDateISO(getTodayAR())` usando el helper existente. NO se renombra ni se parametriza el helper para multi-timezone en este pit-stop.

**Reason:** La columna `profiles.financial_timezone` ya existe (migración 0012), preparada para multi-tz. La transición a `getToday(tz)` se hace cuando se introduzca la feature de soporte multi-tz, en una change dedicada — un único refactor honesto en lugar de un nombre genérico hoy con implementación AR-only.

**Implicancia para el test:** el test del `vi.setSystemTime` que se agrega ahora sirve sin cambios el día que se parametrice el TZ; solo habrá que sumar un caso adicional para otra zona horaria.

### Decision 5: Check automático ligero, no hooks de Claude Code

El enforcement del workflow se hace con `pnpm openspec:check` (grep simple), llamado manualmente antes del merge. No se instalan hooks de Claude Code (`PostToolUse`, etc.) en este pit-stop.

**Reason:** Hooks suman fricción a tareas no relacionadas y son más difíciles de mantener. Un script idempotente que el flujo de merge llama explícitamente cubre el caso sin sobrediseño. Si en el futuro el equipo decide automatizarlo más (CI, pre-push hook), es trivial sumarlo encima del mismo script.

### Decision 6: Naming definitivo

Nombre del package de tipos UI: `@grana/ui-contracts` (descriptivo, alineado con `ui-tokens`).

Nombre del package de lógica financiera pura: `@grana/money-logic` como nombre por defecto, sujeto a confirmación en task 8.1. Alternativas evaluadas: `@grana/calculations` (demasiado genérico), `@grana/finance-logic` (redundante con `money`).

## Risks / Trade-offs

- **Riesgo:** Que la creación de `@grana/ui-contracts` y `@grana/money-logic` sume burocracia para cambios menores. **Mitigación:** Los contratos se editan en el mismo PR que toca el componente; no requieren ceremonia adicional. El package es source-only, sin build step.
- **Riesgo:** Que el script `openspec:check` se vuelva un falso positivo si openspec cambia el formato del placeholder en el futuro. **Mitigación:** El script es 5 líneas; revisable en cualquier momento.
- **Trade-off:** Documentar el workflow en `CLAUDE.md` depende de que las sesiones futuras lo lean. No es enforcement de runtime. **Mitigación:** El check automático compensa: incluso si una sesión ignora el checklist, el merge no pasa con specs en TBD.
- **Trade-off:** El plan no agrega tests de invariantes contables generales; eso va a P1. Se acepta porque (a) el bug del `new Date()` sí tiene test propio acá, y (b) los invariantes restantes hoy dependen de triggers de DB documentados en `CLAUDE.md` y no han producido bugs reportados.
- **Trade-off:** Mover lógica pura a `@grana/money-logic` significa que un import desde `apps/web/lib/transactions/balance.ts` cambia su path. **Mitigación:** Se mantiene un re-export temporal desde el path viejo durante esta change para minimizar el blast radius; el cleanup definitivo de imports puede hacerse en una iteración posterior.
