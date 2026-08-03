## MODIFIED Requirements

### Requirement: La paridad web↔mobile se sostiene por contratos de props compartidos

Grana SHALL mantener dos implementaciones nativas de cada primitivo de UI: una en `apps/web/components/ui/` y otra en `apps/mobile/components/ui/`. NO se SHALL intentar compartir JSX entre web y React Native; ambas implementaciones permanecen independientes en su árbol de DOM/View nativo.

Las capas de componentes y su ubicación canónica por plataforma son propiedad de `ui-foundations`, no de esta capability. Este requirement gobierna la **política de paridad** entre las dos implementaciones; cuando una ruta aparezca en ambas capabilities, la de `ui-foundations` SHALL prevalecer.

La paridad de API entre ambas SHALL estar garantizada por **tipos de props compartidos** vivos en el package `@grana/ui-contracts`. Cada componente equivalente en web y mobile MUST importar el mismo prop type desde `@grana/ui-contracts` y exponerlo como su prop signature pública. Las implementaciones MAY aceptar props adicionales propias de su plataforma vía intersection con el tipo del contrato, pero NO MAY divergir en los nombres, tipos ni semántica de las props comunes.

Las convenciones de naming adoptadas (las que difieren entre web y RN) SHALL quedar documentadas en `packages/ui-contracts/README.md`. Una convención fijada por esta spec: los callbacks de interacción se llaman `onPress` (no `onClick`) en ambos lados, alineado con la convención de React Native.

Esta política aplica a los primitivos de UI (`Button`, `Card`, `Input`, `Label`, `Alert`, `Spinner`, `FormField`, `PasswordField` y futuros). NO aplica a la lógica de negocio pura: para eso existe `@grana/money-logic`, donde una única implementación SHALL ser consumida por ambas plataformas.

#### Scenario: Web y mobile importan el mismo prop type

- **WHEN** un colaborador define un componente primitivo equivalente en web y mobile (por ejemplo `Button`)
- **THEN** ambos archivos importan `ButtonProps` desde `@grana/ui-contracts`
- **AND** ambos archivos exponen `Button(props: ButtonProps)` como su firma pública

#### Scenario: Una prop nueva en el contrato obliga a mobile a implementarla

- **WHEN** un colaborador agrega una nueva prop obligatoria al tipo `ButtonProps` en `@grana/ui-contracts`
- **THEN** TypeScript marca como error el archivo `apps/mobile/components/ui/Button.tsx` hasta que mobile la implemente
- **AND** la PR NO puede mergearse mientras mobile no cumpla el contrato

#### Scenario: Una implementación necesita una prop específica de su plataforma

- **WHEN** la implementación de mobile necesita una prop extra que no aplica a web (por ejemplo, haptic feedback)
- **THEN** mobile expone su firma como `MobileButtonProps = ButtonProps & { hapticFeedback?: 'light' | 'medium' }`
- **AND** la prop extra NO se agrega al contrato compartido

#### Scenario: Un primitivo mobile nuevo se crea bajo components/ui/

- **WHEN** un colaborador crea un primitivo de UI nuevo en mobile
- **THEN** el archivo vive en `apps/mobile/components/ui/`, junto a los primitivos existentes (`Button.tsx`, `Card.tsx`, `Input.tsx`, …)
- **AND** NO se coloca suelto en `apps/mobile/components/`, que está reservado para carpetas de componentes por feature (`accounts/`, `cards/`, `settings/`, …)

#### Scenario: Lógica financiera no se duplica entre apps

- **WHEN** una función de cálculo financiero puro (balance, derivación de período, generación de fechas de recurrencia) es necesaria en web y mobile
- **THEN** la función vive en `@grana/money-logic` y ambas apps la importan desde ahí
- **AND** ninguna app reimplementa la función en su propio `lib/`
