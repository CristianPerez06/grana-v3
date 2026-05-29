## Context

Mobile heredó dos stacks de input por evolución, no por diseño:

- `TextInput` (bespoke) fue el primer primitivo de campo cuando se trajo el shell mobile (commit `7542e1b feat(mobile): add core UI component library mirroring web primitives`). Encapsula label + input + error + `mb-4` en una sola pieza.
- Más tarde, al introducir `@grana/ui-contracts`, se crearon `Input` (bare, contract) + `Label` + `FormField` (composed) para hacer cumplir paridad con web vía TypeScript. `PasswordField` se construyó sobre `FormField`.

Auth quedó atrapado en la transición: usa `TextInput` para email/nombre y `PasswordField` (contract) para passwords, envolviendo cada `PasswordField` en `<View className="mb-4">` para falsificar el ritmo vertical del bespoke. El change `2026-05-27-auth-component-reuse-parity` corrigió la elección de primitivo de password pero dejó el follow-up de consolidación explícito.

El primitivo equivalente en web NO existe: web tiene `Input` + `FormField`, sin `TextInput`. La regla de spec "pantallas equivalentes SHALL usar el primitivo equivalente de su plataforma" no puede cumplirse mientras mobile use `TextInput`.

`MoneyAmountInput` quedó como satélite: mobile lo construyó sobre `TextInput` (hereda label+error+margin); web lo definió como un `<input>` bare y los callers componen label/error inline. Misma intención de paridad (sanitize keystrokes + decimal-pad), distinto nivel de abstracción.

## Goals / Non-Goals

**Goals:**

- Que `TextInput` deje de existir en mobile. Todo campo de texto pasa por `FormField` (composed) o `Input` (bare).
- Que `MoneyAmountInput` mobile sea el mismo nivel de abstracción que web: un input bare, sin shell propio. Caller compone label/error si los necesita.
- Que el ritmo vertical de los formularios sea posesión del contenedor padre (`flex-col gap-X`), no del primitivo. Misma regla en ambas plataformas.
- Que `MoneyAmountInputProps` viva en `@grana/ui-contracts` y ambas plataformas lo importen, cerrando la última grieta de paridad de tipos.
- Codificar la regla de spacing ownership en `project-conventions` para evitar la regresión.

**Non-Goals:**

- NO crear un `MoneyField` (label+input+error compuesto) en este change. Hoy hay 2 call sites en mobile, web tampoco tiene field shell para money — esperar a que la duplicación real aparezca ([[feedback_reusable_components]]).
- NO migrar formularios futuros que no existen (transacciones, recurrencias, cards, accounts mobile) — fuera de scope porque no hay código aún.
- NO tocar comportamiento de auth ni onboarding (mismas validaciones, navegación, copy, claves i18n).
- NO cambiar `parseMoneyInput` ni la lógica de `@grana/money-logic`.
- NO modificar las pantallas de categories (ya están en Pattern B).

## Decisions

### Decisión 1: `MoneyAmountInput` mobile se reescribe sobre `Input`, no sobre `FormField`

**Por qué:** Web tiene `MoneyAmountInput` como `<input>` bare (sin label/error/margin propio). Espejarlo significa que mobile también es un input bare sobre `Input`. Los callers componen su shell — exactamente como hacen `accounts/new` y `pay-card-period-form` en web.

**Alternativa considerada:** Que mobile tenga `MoneyAmountInput` bare *y* además un `MoneyField` (label+input+error). Rechazada por [[feedback_reusable_components]]: hay 2 call sites en mobile hoy (`initial-balance` x2), no se justifica extracción todavía. Si emerge duplicación al introducir formularios futuros de dinero, se evalúa entonces.

**Trade-off:** Los 2 call sites de `initial-balance` pasan de 6 líneas a ~10 líneas por campo (Label + MoneyAmountInput + error inline). Ganamos paridad de abstracción con web y evitamos crear primitivos que sirven a 2 llamadas.

### Decisión 2: `MoneyAmountInputProps` entra al contrato como tipo minimal (`className?`)

**Por qué:** Web actualmente define `Props` localmente en `money-amount-input.tsx`. Mobile también. Sin contrato compartido no hay TypeScript que detecte divergencia futura. La asimetría conocida (`onChange` web vs `onChangeText` mobile en el callback de valor) tiene precedente en `Input`: el contrato expone `InputProps = { invalid?: boolean; className?: string }` y cada plataforma intersecta con su prop nativa de valor. Replicamos exactamente ese patrón.

**Tipo agregado:**
```ts
export type MoneyAmountInputProps = {
  className?: string
}
```

Cada plataforma lo extiende:
- Web: `MoneyAmountInputProps & { value: string; onChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange'>`
- Mobile: `MoneyAmountInputProps & { value: string; onChangeText: (value: string) => void } & Omit<TextInputProps, 'keyboardType' | 'inputMode' | 'onChangeText'>`

**Alternativa considerada:** Dejarlo fuera del contrato (status quo). Rechazada porque cierra la última grieta — todos los primitivos listados en la spec tienen contrato; mantener uno fuera sin razón estructural es deuda silenciosa.

### Decisión 3: `AuthShell` se hace dueño del gap vertical (`flex-col gap-4`)

**Por qué:** Una sola línea cambia el modelo de espaciado de "primitivo aporta margen" a "padre aporta ritmo". Es exactamente cómo lo hace categories (`<View className="flex-col gap-4">`) y cómo lo hace web (Tailwind `flex flex-col gap-4` o similar). Centraliza la decisión en un sitio, elimina los `<View className="mb-4">` manuales que envolvían `PasswordField`.

**Alternativa considerada:** Que cada pantalla de auth defina su propio container. Rechazada porque AuthShell ya existe precisamente para encapsular el chrome compartido — el gap entre campos es chrome.

### Decisión 4: Codificar la regla de spacing ownership en `project-conventions`

**Por qué:** Sin regla escrita, un futuro contribuidor puede recrear un primitivo de campo con `mb-4` propio sin violar ninguna norma listada. La regla es genuinamente cross-platform (web's `FormField` ya la cumple — no bakea margen). Una requirement modificada con un scenario nuevo basta; no justifica una requirement separada.

**Alternativa considerada:** Dejarlo como convención implícita. Rechazada porque la regresión más probable es exactamente la que ya pasó (un primitivo de campo con margen propio); vale la pena un scenario para sellarla.

## Risks / Trade-offs

- **[Riesgo]** Cambio visual sutil de `TextInput` (`h-11 rounded-lg border bg-card px-3 text-sm`) a `Input` (`h-11 w-full rounded-lg border bg-card px-3 text-sm`). Las clases son equivalentes salvo `w-full` (que mobile probablemente ya provee implícitamente por el `flex-col` padre) y el manejo del focus border (`Input` usa `useState` + `border-emerald` cuando enfocado; `TextInput` usa Tailwind `focus:border-emerald`). → **Mitigación:** verificación visual en simulador iOS antes de archivar; los dos estados (idle/focused/error) se comparan en signup y login.
- **[Riesgo]** El gap del padre (`gap-4` = 16px) puede no coincidir exactamente con el `mb-4` (16px) que tenía `TextInput`. → **Mitigación:** son la misma medida; el riesgo está en que el gap se aplica entre hijos pero no después del último, mientras que `mb-4` se aplicaba siempre. Visualmente solo afecta el espacio bajo el último campo antes del botón de submit — verificar que el `mt-8` o gap del CTA siga viéndose bien.
- **[Riesgo]** `MoneyAmountInput` web adopta tipo de contrato — si web tiene callers que pasan props no soportadas por el tipo compartido, TypeScript fallará. → **Mitigación:** el tipo solo agrega `className?`, ambas plataformas siguen aceptando sus props nativas vía intersection. Bajo riesgo. Se corre `pnpm --filter web typecheck` antes de archivar.
- **[Riesgo]** `initial-balance.tsx` queda con composición inline (Label + MoneyAmountInput + error). Si el patrón se repite en futuros forms de dinero, refactor posterior necesario. → **Mitigación:** explícito en proposal como follow-up. Hoy son 2 call sites; la regla [[feedback_reusable_components]] dice esperar a ≥2 rutas con duplicación real.
- **[Trade-off]** Más líneas por call site de `MoneyAmountInput` en mobile (de 6 a ~10) a cambio de paridad de abstracción con web. Aceptable porque sólo hay 2 call sites hoy.

## Migration Plan

No aplica — el cambio es interno a `apps/mobile` + 1 tipo compartido en `ui-contracts` + 1 edición de tipo en `apps/web`. No hay schema migrations, no hay despliegue staged. La rama feature corre type-check y lint en CI; el merge a main lo decide el usuario ([[feedback_never_merge_to_main]]).

## Open Questions

Ninguna abierta. Las decisiones quedan tomadas; cualquier ajuste fino del Tailwind exacto en `Input` vs `TextInput` se resuelve durante la implementación con verificación visual.
