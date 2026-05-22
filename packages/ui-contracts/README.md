# @grana/ui-contracts

Tipos de props compartidos entre las implementaciones nativas de los primitivos UI de web (`apps/web/components/ui/`) y mobile (`apps/mobile/components/ui/`).

## Por qué este package existe

JSX no se comparte entre web y React Native: `<div>` no existe en RN, `<View>` no existe en web. Por eso Grana mantiene **dos implementaciones nativas** de cada primitivo, una por plataforma. La paridad entre ambas se garantiza con **un tipo de props compartido**: si web le agrega una variante a `ButtonProps`, TypeScript rompe el build de mobile hasta que mobile la implemente (y viceversa).

Política completa en `CLAUDE.md` → "Web ↔ Mobile policy" y en `openspec/specs/project-conventions/spec.md` → requirement "La paridad web↔mobile se sostiene por contratos de props compartidos".

## Cómo se usa

Cada implementación importa el tipo y lo expone como su prop signature:

```ts
// apps/web/components/ui/button.tsx
import type { ButtonProps } from '@grana/ui-contracts'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

type WebButtonProps = ButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
    asChild?: boolean
  }

export const Button = forwardRef<HTMLButtonElement, WebButtonProps>(/* ... */)
```

```ts
// apps/mobile/components/ui/Button.tsx
import type { ButtonProps } from '@grana/ui-contracts'

type MobileButtonProps = ButtonProps & {
  /** Legacy: pre-contract call-sites passed the label as `title`. */
  title?: string
}

export function Button(props: MobileButtonProps) { /* ... */ }
```

Las **props comunes** salen del contract y NO se renombran ni se re-tipean. Cada implementación PUEDE sumar props específicas de su plataforma vía intersection (`& { ... }`).

## Convenciones de naming

- **`onPress` para interacción**, no `onClick`. React Native usa `onPress`; web mapea internamente a `onClick`. Esto evita que el código de UI compartido tenga que decidir cuál nombre usar.
- **`children` para contenido**, no `title` ni `label`. (Mobile Button hoy todavía expone un `title?` legacy para no romper call-sites pre-contract; queda como deuda P2.)
- **Variantes** comunes en mayúsculas-conceptuales: `primary | secondary | ghost | destructive | link`.
- **Tamaños** comunes: `sm | md | lg`.

## Lo que NO entra acá

- **Componentes específicos de una plataforma** (`MoneyAmountInput` solo-web, `InstitutionPickerModal` solo-mobile, `FormError` solo-mobile). El contract solo cubre primitivos que existen como par equivalente en ambos lados.
- **Hooks de lógica** (`useEyeMask`, `useShowCents`, `useDisabled`). El alcance está acotado a *prop shapes* por ahora. Si más adelante hace falta unificar contratos de hooks, sumamos un sub-módulo `@grana/ui-contracts/hooks` en una change dedicada.
- **Implementaciones**. El package es source-only de TypeScript y no contiene JSX, estilos, CSS, ni dependencias de React Native.

## Cómo agregar un nuevo primitivo

1. Definí el tipo de props acá en `src/index.ts` con la API mínima común a ambas plataformas.
2. Importalo desde la implementación de web y la de mobile.
3. Si el componente solo existe en una plataforma, **no lo agregues acá** — vivirá como `apps/<name>/components/.../<X>.tsx` con su tipo inline.
4. Si una plataforma necesita una prop extra, intersection: `MyContractProps & { extra?: ... }`.
