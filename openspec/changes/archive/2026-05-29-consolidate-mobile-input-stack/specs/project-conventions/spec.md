## MODIFIED Requirements

### Requirement: Capas de componentes UI y ubicación de componentes compuestos

Los componentes de UI de Grana SHALL organizarse en tres capas según su reutilización, y cada capa SHALL vivir en una ubicación canónica por plataforma:

1. **Primitivos de UI** — building blocks básicos (`Button`, `Card`, `Input`, `FormField`, `PasswordField`, `MoneyAmountInput`, `Alert`, `Spinner`, `Label`, …). SHALL vivir en `apps/web/components/ui/` y `apps/mobile/components/ui/`, una implementación nativa por plataforma, con el prop type compartido en `@grana/ui-contracts`. En web cada primitivo SHALL tener una story de Storybook; mobile no tiene Storybook y SHALL espejar los primitivos por nombre. Los primitivos de campo (`Input`, `FormField`, `PasswordField`, `MoneyAmountInput`) NO MAY incluir vertical margin propio (`mb-*`, `mt-*`, `my-*`); el ritmo vertical entre campos SHALL ser propiedad del contenedor padre (`flex-col gap-X` o equivalente).
2. **Componentes compuestos** — reutilizables entre rutas pero no lo bastante genéricos para `ui/` (sin Storybook). Se dividen en:
   - **Shells de app/route-group:** SHALL vivir en `apps/<app>/components/layout/` (`AuthShell`, `TabBar`, `AppMenu`). La ubicación coincide entre plataformas.
   - **Compartidos de feature:** compartidos entre rutas de una misma feature. En web SHALL vivir bajo el route group en `apps/web/app/(group)/_components/` (Next.js ignora los directorios con prefijo `_`). En mobile NO MAY colocarse bajo `app/` (Expo Router trata `app/` como rutas) y SHALL vivir en `apps/mobile/components/<feature>/`.
3. **Locales de ruta/pantalla** — de un solo uso, colocados junto a la ruta (`login/login-form.tsx` en web; inline en la pantalla en mobile).

La divergencia de ubicación de los compartidos de feature entre web y mobile es intencional y la fuerza el router; NO viola la política Web↔Mobile (que prohíbe compartir JSX y exige paridad de API por contratos, no rutas de carpeta idénticas).

Como regla de uso derivada: pantallas equivalentes en web y mobile SHALL usar el primitivo equivalente de su plataforma. En particular, un campo de contraseña SHALL usar el primitivo `PasswordField` (con toggle ver/ocultar) en ambas plataformas, NUNCA un input crudo con `secureTextEntry`. Un campo de dinero SHALL usar el primitivo `MoneyAmountInput` (sanitización de keystrokes + `inputMode="decimal"` / `keyboardType="decimal-pad"`) en ambas plataformas, NUNCA un `<input type="number">` (web) ni un `TextInput` crudo (mobile).

#### Scenario: Un primitivo nuevo vive en components/ui de ambas apps con story en web

- **WHEN** un colaborador agrega un primitivo de UI nuevo
- **THEN** crea la implementación en `apps/web/components/ui/` (con su `*.stories.tsx`) y en `apps/mobile/components/ui/`
- **AND** define el prop type compartido en `@grana/ui-contracts`

#### Scenario: Un componente compartido entre rutas de una feature se ubica según el router de la plataforma

- **WHEN** un colaborador necesita reutilizar un componente entre varias rutas de una misma feature (no genérico para `ui/`)
- **THEN** en web lo coloca en `apps/web/app/(group)/_components/`
- **AND** en mobile lo coloca en `apps/mobile/components/<feature>/`, no bajo `app/`

#### Scenario: Pantallas equivalentes usan el primitivo equivalente

- **WHEN** una pantalla de auth necesita un campo de contraseña en web y en mobile
- **THEN** ambas plataformas usan el primitivo `PasswordField` (con toggle ver/ocultar)
- **AND** ninguna usa un input crudo con `secureTextEntry`

#### Scenario: Un campo de dinero usa MoneyAmountInput en ambas plataformas

- **WHEN** una pantalla necesita capturar un monto de dinero (saldo, importe, límite) en web o en mobile
- **THEN** la pantalla usa el primitivo `MoneyAmountInput` de su plataforma, que sanitiza keystrokes a dígitos + un único separador decimal
- **AND** web NO usa `<input type="number">` (riesgo de spinner/wheel/arrows perdiendo centavos por aritmética float)
- **AND** mobile NO usa un `TextInput` crudo de React Native con `keyboardType="decimal-pad"` ni un primitivo de campo bespoke equivalente

#### Scenario: Un primitivo de campo no bakea margen vertical propio

- **WHEN** un colaborador agrega o modifica un primitivo de campo (`Input`, `FormField`, `PasswordField`, `MoneyAmountInput`, o un futuro primitivo equivalente)
- **THEN** el primitivo NO incluye clases `mb-*`, `mt-*`, ni `my-*` en su root
- **AND** las pantallas que componen varios campos SHALL controlar el ritmo vertical mediante un contenedor padre con `flex-col gap-X` (o equivalente nativo de la plataforma)
- **AND** las pantallas NO MAY envolver primitivos en `<View>` / `<div>` auxiliares solo para agregar margen vertical alrededor de un campo
