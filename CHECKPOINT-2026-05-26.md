# 🟡 Checkpoint grana-v3 — AMARILLO

**Fecha:** 2026-05-26
**Alcance:** repo completo
**Branch:** `main` (limpio)
**Verificaciones ejecutadas:** web typecheck ✓, mobile typecheck ✓, web tests ✓ (192 tests / 19 archivos), `openspec:check` ✓ — todos exit 0.

---

## TL;DR

1. El repo está **sano y consistente**: compila (web + mobile typecheck ✓), 192 tests verdes en 19 archivos, `openspec:check` pasa, `main` limpio y sin changes activas colgadas.
2. La deuda es **manejable y casi toda documental o cosmética** — ningún invariante contable está roto, la lógica de negocio está bien centralizada en `packages/money-logic`.
3. Hay **un drift peligroso**: la sección "Email templates" de CLAUDE.md describe un flujo de auth que el código ya no usa — una mina para una IA fresca. Pit-stop opcional y corto.

---

## Hallazgos por dimensión

| Dimensión | Estado | Hallazgo principal (verificado) |
|---|---|---|
| Build / Tests | ✅ OK | web+mobile typecheck exit 0; 192 tests pasan; `openspec:check` exit 0 |
| Specs ↔ código | ✅ OK | Sin specs huérfanos, sin código huérfano, sin secciones delta en masters, sin `Purpose: TBD` |
| Recurring-movements spec | ✅ OK | **Falso positivo del agente**: sus requirements viven en `transactions/spec.md` (63 menciones) — G4, correcto |
| Email templates ↔ CLAUDE.md | ⚠️ Atención | `CLAUDE.md:159-162` manda flujo link `/auth/callback?token_hash=…`; los templates y el código usan **OTP 8 dígitos** (`otp-verify-form.tsx:58`, `verifyOtp`). CLAUDE.md está stale |
| Fecha financiera | ⚠️ Atención | `movement-filters.tsx:69` usa `monthOf(new Date())` en vez de la fecha AR para el mes por defecto del filtro (display, client-side) |
| Reutilización lógica | ✅ OK | Balance/períodos/recurrencias en `packages/money-logic`; `new Date()` en server actions son todos a `TIMESTAMPTZ` (`onboarding.ts:151`, `recurrences.ts:279,347`) — correctos (G2) |
| Server actions | ⚠️ Menor | `getAuthenticatedUserId()` duplicado 5× (`accounts.ts:26`, `categories.ts:21`, `credit-cards.ts:46`, `recurrences.ts:30`, `transactions.ts:34`) |
| READMEs de packages | ⚠️ Atención | Solo 2/7 tienen README (`money-logic`, `ui-contracts`); faltan en `dashboard`, `i18n-messages`, `supabase`, `ui-tokens`, `validation` |
| Tamaño de archivos | ⚠️ Menor | `credit-cards.ts` 1052 líneas; `movement-form.tsx` 971 líneas |
| Estructura de spec | ⚠️ Cosmético | `schema-base/spec.md` es el único master sin header `# … Specification` ni `## Purpose` (no rompe el gate) |
| Tests mobile | ℹ️ Conocido | Mobile sin tests; duplicación `lib/date.ts` y `lib/cards/*` con TODO explícito — deuda planificada (G7) |

---

## Lo que sí está bien

- **El contrato Web↔Mobile se respeta**: primitivos separados con prop types compartidos en `ui-contracts`, convención `onPress` en ambos lados.
- **Lógica monetaria centralizada**: `balance.ts`, `cards.ts`, `recurrences.ts`, `movements.ts` viven en `packages/money-logic`; web los re-exporta sin duplicar el cálculo.
- **Cobertura de invariantes clave**: saldo negativo + aviso, running balance, recurrencias y `getTodayAR` tienen tests (`negative-balance-warning`, `running-balance`, `date.test.ts`).
- **Spec hygiene impecable**: cero placeholders TBD, cero secciones delta en masters, todo archivado (no hay changes activas sin cerrar).
- **Docs de entrada excelentes**: `README.md` y `SUPABASE_SETUP.md` en español, mencionan ambas apps, pasos de setup reales, 15 migraciones cubiertas.
- **Server actions consistentes**: patrón `ActionResult<T>` centralizado en `_actions/types.ts`, manejo de errores uniforme.

---

## Riesgos sistémicos (qué dolería en 2 meses)

1. **Drift CLAUDE.md ↔ auth real**: una IA fresca a la que le pidan "arreglar el template de confirmación" leería `CLAUDE.md:159-162`, agregaría los URLs de link y **rompería el flujo OTP que funciona**. Es exactamente el escenario que el repo dice querer evitar.
2. **Mobile sin red de seguridad**: la lógica duplicada en mobile (date, cards) no tiene tests; cualquier cambio ahí es a ciegas hasta migrarla a `packages`.
3. **Erosión de `getTodayAR`**: que `new Date()` se cuele en código de display (filtros) normaliza la excepción; conviene cortarla temprano antes de que se copie a mobile.
4. **Archivos grandes**: `credit-cards.ts` (1052) y `movement-form.tsx` (971) concentran demasiada lógica — futuros cambios de tarjetas/formulario se vuelven riesgosos.

---

## Plan de acción priorizado

### P0 — pit-stop inmediato (~30 min, solo docs)

- Actualizar la sección "Email templates" de `CLAUDE.md:155-165` para reflejar el **flujo OTP real** (código de 8 dígitos vía `verifyOtp`), eliminando el mandato de URLs `/auth/callback?token_hash=…`.
  - *Por qué:* es el único hallazgo que activamente engaña a una IA fresca.

### P1 — en paralelo al próximo feature

- Cambiar `movement-filters.tsx:69` a derivar el mes por defecto de la fecha AR, no `new Date()`.
  - *Esfuerzo:* bajo. *Por qué:* corrige el invariante de fecha financiera antes de copiarse a mobile.
- Agregar `README.md` a los 5 packages sin él (1-3 líneas: rol + qué exporta).
  - *Esfuerzo:* bajo. *Por qué:* el objetivo fundacional es "el repo es la memoria".

### P2 — cuando moleste, no antes

- Extraer `getAuthenticatedUserId()` a `_actions/_lib/`. *Trivial, 5 call-sites.*
- Agregar header `# schema-base Specification` + `## Purpose` a `schema-base/spec.md`. *Cosmético.*
- Header de comentario a `0005_categories.sql`. *Trivial.*
- Evaluar descomposición de `credit-cards.ts` y `movement-form.tsx`. *Solo si vuelven a tocarse.*

---

## Decisiones que requieren input del usuario

1. **Tests en mobile**: ¿se introduce un harness de test en `apps/mobile` ahora, o se difiere hasta migrar `lib/date` y `lib/cards` a `packages` (que de paso los cubre con los tests existentes de web)? La segunda opción mata dos pájaros.
2. **`MoneyAmountInput` en mobile**: web tiene el primitivo, mobile no. ¿Mobile aún no tiene formularios de monto (entonces es correcto que no exista) o es un gap real a llenar?

---

**Color AMARILLO**: deuda manejable, pit-stop **opcional**. Nada bloquea seguir con features.

Próximo paso sugerido: una openspec change formal que agrupe P0 + P1 (fix de docs de auth + `new Date()` en filtros + READMEs de packages) bajo una sola unidad de trabajo.
