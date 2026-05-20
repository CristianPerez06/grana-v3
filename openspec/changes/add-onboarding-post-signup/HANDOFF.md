# Handoff — `add-onboarding-post-signup`

Branch: `feature/onboarding-post-signup`
Estado: ✅ implementación completa, ⏳ QA pendiente, ⏳ merge pendiente.

Este documento es la guía para el tech lead que toma el branch para llevarlo a `main`. Las decisiones de producto y técnicas viven en `proposal.md` y `design.md` de esta misma carpeta; acá solo está el "qué hacer" en orden.

---

## 1. Estado del branch al momento del handoff

- **14 commits incrementales** sobre `main`, uno por grupo de tareas. Squashear es trivial.
- **Migración de DB ya aplicada** a Supabase prod (`exhpnnaigjfcxcvmptxa`) por el owner: `supabase/migrations/0012_profiles_onboarding_and_default_account.sql`. NO volver a aplicarla.
- **Cuenta default renombrada** en DB de `Efectivo` → `Billetera`. Owner ya tiene `onboarding_completed_at` seteado, así que NO va a ver el wizard.
- **Tipos TypeScript** (`packages/supabase/src/types.ts`) actualizados manualmente con los 3 campos nuevos de `profiles`. Si se regeneran con `supabase gen types`, debería producir la misma forma.
- **Tests**: 121/121 pasan (`pnpm --filter web exec vitest run`). 16 nuevos sobre los schemas del onboarding.
- **Typecheck**: `pnpm --filter web exec tsc --noEmit` exit 0.
- **OpenSpec**: `openspec validate add-onboarding-post-signup --strict` pasa.

---

## 2. QA manual (§12) — bloquea el merge

Pre-requisito: el módulo `dashboard` tiene que estar implementado para que el QA tenga adónde aterrizar (por eso el owner difirió este paso).

Setup mínimo:

```powershell
git checkout feature/onboarding-post-signup
pnpm install      # por si hubiera cambios de deps desde tu último checkout
pnpm dev
```

Después en el navegador:

### 12.1 — Crear usuario de prueba

Registrate en `/signup` con un alias del owner (ej: `cristian.ap84+qa1@gmail.com`). Validá el OTP. Loguéate.

> Si el OTP no llega en ~30s, mirá `Authentication > Logs` en el dashboard de Supabase.

### 12.2 — Variante "Vista simple" (novato)

1. Después del login, el middleware te redirige a `/onboarding/welcome` automáticamente. Si no lo hace, es bug.
2. Empezar → elegir card **"Lo esencial"** → Continuar.
3. En `/saldo-actual` cargar p.ej. `50000` en ARS, dejar USD vacío → Continuar.
4. En `/done` ver "Tu disponible: $50.000" → Ir al dashboard.
5. Verificar en `accounts` (Supabase) que **NO** se creó cuenta bancaria para este user.
6. Verificar en `profiles` que `mode='novato'` y `onboarding_completed_at` tiene un timestamp.

### 12.3 — Variante "Con más detalle" + banco (experto)

1. Nuevo user (otro alias).
2. Elegí **"Con más detalle"** → aparece la pregunta de banco → marcá **Sí** → elegí una institución (p.ej. Galicia) → nombre `Caja de ahorro` → Continuar.
3. En `/saldo-actual` ver **dos grupos**: "En Caja de ahorro" y "En efectivo (opcional)". Cargar saldos en ambos.
4. Llegar a `/done` y ver el disponible total agregado.
5. En `accounts` verificar que existe una fila `type=bank, name='Caja de ahorro', institution_id` apuntando a Galicia.
6. En `account_currencies` verificar que las dos filas (ARS + USD) de esa cuenta tienen `initial_balance` con los montos ingresados.

### 12.4 — Validación de bloqueo (no skip)

1. Nuevo user.
2. En `/onboarding/perfil` confirmar que **NO** hay botón "Saltar este paso".
3. Intentar "Continuar" sin elegir card → error visible, no avanza.
4. Elegir card → avanzar.
5. En `/onboarding/saldo-actual` confirmar que **NO** hay botón "Saltar este paso".
6. Intentar "Continuar" con el input de ARS principal vacío → mensaje: *"Cargá cuánta plata tenés en pesos hoy (puede ser 0)"*. No avanza.
7. Cargar `0` en ARS → Continuar → llega a `/done` con disponible $0.

### 12.5 — Idempotencia de done

1. Con un user que ya completó onboarding, navegar manualmente a `/onboarding/welcome` o `/onboarding/done`.
2. La pantalla debe renderizar sin redirigir al login ni romper.
3. El timestamp en `profiles.onboarding_completed_at` NO debe cambiar al revisitar `/done` (idempotencia).

### Si encontrás un bug

- Bugs claros de implementación: hablalo con el owner antes de tocar — capaz el spec ya lo cubre y es solo cuestión de revisar.
- Bugs que requieren cambio de spec: abrir `openspec-explore` para discutirlo.

---

## 3. Merge a `main` (§14) — solo después del QA verde

Convención del repo (de `CLAUDE.md`): **un único commit por feature en `main`, merge `--ff-only`, sin merge commits**.

### 14.1 — Squashear los 14 commits en uno

Desde el branch:

```powershell
git fetch origin
git rebase -i origin/main
```

En el editor interactivo: dejar el primer commit como `pick`, los 13 siguientes como `s` (squash) o `f` (fixup). Sugerencia de mensaje final:

```
feat(onboarding): add post-signup wizard with bimoneda defaults

Three-screen blocking wizard between signup and dashboard:
  /welcome → /perfil → /saldo-actual → /done

- profiles extended with mode, financial_timezone,
  onboarding_completed_at (migration 0012).
- default cash account renamed Efectivo → Billetera; trigger and
  existing rows updated.
- middleware redirects to /onboarding/welcome whenever a logged-in
  user lands on a protected route with onboarding_completed_at IS NULL.
- bank account (institution + name) created inline when the user
  picks "Con más detalle" and answers Sí to bank.
- /saldo-actual writes account_currencies.initial_balance directly
  (never inserts into transactions). Primary ARS is mandatory; zero
  is a valid declaration. No skip allowed on any step.
- CLAUDE.md gains a "Bimoneda por defecto" cross-cutting principle.
- Old NovatoOnboardingForm + completeNovatoOnboarding removed.

Refs: openspec/changes/add-onboarding-post-signup
```

### 14.2 — Rebase sobre `main` actualizado

```powershell
git fetch origin
git rebase origin/main
```

Si hay conflicts, resolverlos preservando el comportamiento descripto en el spec.

### 14.3 — Merge fast-forward a `main`

```powershell
git checkout main
git pull --ff-only origin main
git merge --ff-only feature/onboarding-post-signup
```

Si `git merge --ff-only` falla, significa que `main` se movió desde tu último rebase. Repetir 14.2.

### 14.4 — Push a `origin/main`

```powershell
git push origin main
```

NO usar `--force` en `main`. Si push falla por non-fast-forward, repetir 14.2 + 14.3.

### 14.5 — Archive de la change en OpenSpec

Una vez mergeado a `main`:

```powershell
openspec archive add-onboarding-post-signup
```

Esto mueve este directorio a `openspec/changes/archive/<fecha>-add-onboarding-post-signup/` y promueve las 4 delta specs a `openspec/specs/<capability>/spec.md` definitivos.

> Alternativa interactiva: el slash command `/openspec-archive-change` también lo hace y va preguntando.

Commitear el archive con un mensaje tipo:

```
chore(openspec): archive add-onboarding-post-signup
```

Y pushear a `main`.

---

## 4. Cosas que NO hay que hacer

- ❌ **No re-aplicar la migración 0012**. Ya corrió en el dashboard de Supabase. Si el self-check te tira algo raro, no la corrás de nuevo — investigá primero (probablemente sea un user manual con `Efectivo` que no es de trigger).
- ❌ **No regenerar `packages/supabase/src/types.ts`** ciegamente. El archivo está editado manualmente con los 3 campos nuevos de `profiles`. Si lo regenerás con `supabase gen types`, debería dar lo mismo — pero verificar antes de pisar.
- ❌ **No skipear los hooks** (`--no-verify`). Si un hook falla, fijate por qué.
- ❌ **No `--force` push a `main`**. Nunca.
- ❌ **No archivar antes del merge**. Las archivadas tienen fecha en el folder (`YYYY-MM-DD-<name>`) — esa fecha es la del merge.

---

## 5. Decisiones de producto importantes (resumen)

Si tenés dudas sobre el "por qué" antes de tocar algo:

| Tema | Decisión | Dónde |
|---|---|---|
| Tarjeta en onboarding | NO se pregunta ni se crea | `design.md` Decisión 3 |
| Bimoneda por defecto | ARS+USD habilitados al alta sin preguntar | `CLAUDE.md` cross-cutting + `design.md` Decisión 6 |
| Wizard bloqueante | Sin botón "Saltar" en ningún paso | `design.md` Decisión 8 |
| Cuenta default | `Billetera` (era `Efectivo`) | `design.md` Decisión 9 |
| Route group separado | `(onboarding-wizard)/onboarding/` para no heredar Header de `(app)` | `design.md` Q8 |
| Selector instituciones | `<select>` nativo sin opción "Otra" en V1 | `design.md` Q9 |
| `mode` inferido | Vista simple → novato, Vista detallada → experto | `design.md` Decisión 2 |

---

## 6. Open Questions diferidas para futuras changes

- **Latencia del middleware**: cada request protegida hace un SELECT extra a `profiles`. Medir en prod; si pasa el umbral, cachear en cookie firmada. Fuera de scope.
- **Tests de actions + middleware + trigger SQL**: no se hicieron porque requieren infra de mocking. Cobertura actual: schemas + QA manual.
- **Panel "primeros pasos" en dashboard**: el copy de `/done` ya menciona que el user puede arrancar a registrar movimientos desde el dashboard. El panel pedagógico explícito queda para otra change.
- **Toggle "ocultar USD" en settings**: relacionado con "Bimoneda por defecto"; va en módulo `settings` cuando se construya.
