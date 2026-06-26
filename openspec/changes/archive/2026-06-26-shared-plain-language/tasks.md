## 1 · Barrido de i18n (es.json)

- [x] 1.1 `shared.dashboard.current_account_action`: "Cuenta corriente" → "Ver el detalle".
- [x] 1.2 `shared.cuenta_corriente.title`: "Cuenta corriente" → "Las cuentas entre ustedes".
- [x] 1.3 `shared.cuenta_corriente.subtitle`: → "Quién pagó qué y cómo queda el saldo. Nada se borra."
- [x] 1.4 `shared.cuenta_corriente.in_favor_of`: "A favor de {name}" → "Le debés a {name}". `owed_to_you`: "A tu favor" → "{name} te debe". **Trampa confirmada y resuelta:** `in_favor_of` ya pasaba `{name: partner}` en sus 4 sitios; `owed_to_you` se llamaba SIN name en los 4 (cards ARS/USD, proyección, divisor "Hoy") y en todos el contexto es "partner te debe" → se agregó `{name: partner}` a los 4 call-sites (`current-account-view.tsx`, replace_all).
- [x] 1.5 `shared.cuenta_corriente.col_amount`: "Importe" → "Monto".
- [x] 1.6 `shared.cuenta_corriente.split_5050`: "split 50·50" → "mitad y mitad".
- [x] 1.7 `shared.cuenta_corriente.eq_other_shares`: → "Lo que pagaste por {name}". `eq_your_shares`: → "Lo que {name} pagó por vos".
- [x] 1.8 `shared.cuenta_corriente.equation_hide`: "ocultar ecuación" → "ocultar desglose". `equation_show`: "mostrar ecuación" → "mostrar desglose". (`equation_title` "Cómo llegamos a este saldo" se queda.)
- [x] 1.9 **Barrido completo "liquidación → pago"** (consistencia, todas o ninguna): `filter_settlements` "Liquidaciones" → "Pagos entre ustedes"; `eq_reimb_settle` "Reintegros y liquidaciones" → "Reintegros y pagos"; `contra_hint` "Anula la liquidación anterior · no se borra" → "Anula el pago anterior · no se borra"; `revert_confirm` "¿Revertir esta liquidación?" → "¿Revertir este pago?".
- [x] 1.10 `shared.cuenta_corriente.state_contra`: "Contraasiento" → "Anulación". `reversed_hint`: "Anulada por contraasiento" → "Anulada".
- [x] 1.11 `shared.settle.after_remaining`: "Queda {amount} con {name} en la cuenta corriente." → "Queda {amount} con {name}."
- [x] 1.12 **NO tocar:** `reintegro`/`Reintegro`/`reimb_*`, `settle.title`/`settle_action` ("Saldar deuda"), `state_completed`/`state_pending`/`state_reversed`, `col_date`/`col_movement`/`col_change`/`col_balance`.

## 2 · Espejo en en.json

- [x] 2.1 Replicar las mismas claves en `packages/i18n-messages/src/en.json` con su traducción al inglés (sin jerga: "View the detail", "What you owe each other", "Settlements" → mantener consistente, etc.). Mantener paridad de keys con es.json.

## 3 · Verificación

- [x] 3.1 Grep de cadenas hardcodeadas: confirmado que no aparecen **literales** en `apps/web/.../shared/` — los únicos hits ("split 50·50" y "Liquidaciones") son comentarios de código, no UI. Todo el texto visible va por `t(...)`.
- [ ] 3.2 Capa compartida / mobile (tech lead): verificar que la card nativa no hardcodee estos labels; si los lee de i18n, hereda el cambio sin tocar `apps/mobile`. **(pendiente — fuera de nuestro alcance, lo valida el tech lead)**
- [x] 3.3 `pnpm typecheck` · `pnpm lint` · `pnpm test` verde (466 tests, 43 files).
- [x] 3.4 Smoke visual (usuario, OK). Correcciones que surgieron del QA y se aplicaron:
  - **Botón "Ver el detalle":** unificado a **terracota + ícono para todos** los usuarios (antes: ghost/outline cuando había deuda, terracota solo cuando estaba al día). Verde `Saldar` (emerald) + terracota no chocan. (`shared/(home)/page.tsx`)
  - **Encabezado del drawer de saldar:** "Le pagás a {name} · de {amount} que le debés" (confuso, dos montos peleando) → **"Le debés {amount} a {name}"**. Se eliminaron las claves `settle.you_pay_to` y `settle.owe_detail` (solo usadas ahí) y se agregó `settle.you_owe_total`.
  - **Pago parcial (`settle.after_remaining`):** "Queda {amount} con {name}." (incompleto: no decía qué queda) → **"Seguís debiéndole {amount} a {name}."**
  - Nota operativa: editar JSON de `packages/i18n-messages` no lo recompila el HMR de Next → hay que reiniciar `pnpm dev` (borrar `.next` si persiste) para que tome claves nuevas.

## 4 · Cierre (en la rama, antes del merge)

- [ ] 4.1 Aplicar los deltas al master spec (`openspec/specs/shared/spec.md`) y archivar el change (`archive/AAAA-MM-DD-shared-plain-language/`). El merge a main lo hace el usuario.
