## ADDED Requirements

### Requirement: El archive de una change ocurre en la branch antes del merge a main

Cuando una change implementada se considera completa, su archivado SHALL ocurrir como último commit de la branch de trabajo, **antes** del merge `--ff-only` a `main`. El archivado NO se difiere a un commit posterior ni a un PR separado.

Archivado significa: mover la carpeta de `openspec/changes/<name>/` a `openspec/changes/archive/YYYY-MM-DD-<name>/`, aplicar los deltas (`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`) al spec maestro de cada capability tocada en `openspec/specs/<capability>/spec.md`, completar el `Purpose` real del spec maestro reemplazando cualquier placeholder `TBD - created by archiving change ...`, y actualizar `CLAUDE.md` (secciones "Modules" y "Repo Layout") cuando corresponda.

Esta regla sostiene tres invariantes del proyecto:

- El merge a `main` SHALL ser atómico: en una sola commit aparecen el código, los specs maestros actualizados, los `Purpose` completados y los cambios consecuentes en `CLAUDE.md`.
- El estado de `main` SHALL cumplir que cada implementación tiene su spec maestro alineado.
- Cualquier feedback de PR que requiera ajustar el spec MUST aplicarse en la misma branch sin abrir un segundo PR de "archive housekeeping".

El gate de validación SHALL ser el comando `pnpm openspec:check`, que falla si encuentra `TBD - created by archiving` o `Purpose: TBD` dentro de `openspec/specs/`. Este comando MUST correrse antes de cualquier merge a `main` y MUST pasar.

#### Scenario: Branch lista para merge tiene la change archivada

- **WHEN** un colaborador termina la implementación de una change y se prepara para mergear su branch a `main`
- **THEN** la branch tiene como último commit el archivado de la change (mover carpeta + aplicar deltas al spec maestro + completar `Purpose` + actualizar `CLAUDE.md` Modules y Repo Layout si corresponde)
- **AND** el merge a `main` se hace `--ff-only` sin commits adicionales

#### Scenario: Merge a main rechazado si quedan TBD residuales

- **WHEN** el colaborador corre `pnpm openspec:check` sobre una branch que dejó `Purpose: TBD - created by archiving change ...` en algún spec maestro
- **THEN** el comando falla con exit code distinto de 0
- **AND** el merge se posterga hasta completar los `Purpose` reales

#### Scenario: Una change archivada no deja deltas residuales en el spec maestro

- **WHEN** un colaborador archiva una change
- **THEN** el spec maestro de cada capability tocada NO contiene secciones `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements` ni `## RENAMED Requirements`
- **AND** los requirements modificados aparecen integrados en la sección plana `## Requirements`

#### Scenario: Antes de iniciar una change nueva se verifica el solapamiento

- **WHEN** un colaborador va a crear una nueva change que toca una capability `X`
- **THEN** verifica que no exista otra change activa en `openspec/changes/` (excluyendo `archive/`) que también toque la capability `X`
- **AND** si existe, decide el orden de merge y las dependencias antes de empezar la nueva

### Requirement: La paridad web↔mobile se sostiene por contratos de props compartidos

Grana SHALL mantener dos implementaciones nativas de cada primitivo de UI: una en `apps/web/components/ui/` y otra en `apps/mobile/components/`. NO se SHALL intentar compartir JSX entre web y React Native; ambas implementaciones permanecen independientes en su árbol de DOM/View nativo.

La paridad de API entre ambas SHALL estar garantizada por **tipos de props compartidos** vivos en el package `@grana/ui-contracts`. Cada componente equivalente en web y mobile MUST importar el mismo prop type desde `@grana/ui-contracts` y exponerlo como su prop signature pública. Las implementaciones MAY aceptar props adicionales propias de su plataforma vía intersection con el tipo del contrato, pero NO MAY divergir en los nombres, tipos ni semántica de las props comunes.

Las convenciones de naming adoptadas (las que difieren entre web y RN) SHALL quedar documentadas en `packages/ui-contracts/README.md`. Una convención fijada por esta spec: los callbacks de interacción se llaman `onPress` (no `onClick`) en ambos lados, alineado con la convención de React Native.

Esta política aplica a los primitivos de UI (`Button`, `Card`, `Input`, `Label`, `Alert`, `Spinner`, `FormField`, `PasswordField` y futuros). NO aplica a la lógica de negocio pura: para eso existe `@grana/money-logic`, donde una única implementación SHALL ser consumida por ambas plataformas.

#### Scenario: Web y mobile importan el mismo prop type

- **WHEN** un colaborador define un componente primitivo equivalente en web y mobile (por ejemplo `Button`)
- **THEN** ambos archivos importan `ButtonProps` desde `@grana/ui-contracts`
- **AND** ambos archivos exponen `Button(props: ButtonProps)` como su firma pública

#### Scenario: Una prop nueva en el contrato obliga a mobile a implementarla

- **WHEN** un colaborador agrega una nueva prop obligatoria al tipo `ButtonProps` en `@grana/ui-contracts`
- **THEN** TypeScript marca como error el archivo `apps/mobile/components/Button.tsx` hasta que mobile la implemente
- **AND** la PR NO puede mergearse mientras mobile no cumpla el contrato

#### Scenario: Una implementación necesita una prop específica de su plataforma

- **WHEN** la implementación de mobile necesita una prop extra que no aplica a web (por ejemplo, haptic feedback)
- **THEN** mobile expone su firma como `MobileButtonProps = ButtonProps & { hapticFeedback?: 'light' | 'medium' }`
- **AND** la prop extra NO se agrega al contrato compartido

#### Scenario: Lógica financiera no se duplica entre apps

- **WHEN** una función de cálculo financiero puro (balance, derivación de período, generación de fechas de recurrencia) es necesaria en web y mobile
- **THEN** la función vive en `@grana/money-logic` y ambas apps la importan desde ahí
- **AND** ninguna app reimplementa la función en su propio `lib/`
