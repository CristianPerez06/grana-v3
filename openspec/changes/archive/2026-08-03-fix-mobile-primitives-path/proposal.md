# Corregir la ruta de los primitivos mobile en `repo-architecture`

## Why

Dos requirements autoritativos se contradicen sobre dónde viven los primitivos de UI de mobile:

- `repo-architecture` → "una en `apps/web/components/ui/` y otra en **`apps/mobile/components/`**".
- `ui-foundations` → "SHALL vivir en `apps/web/components/ui/` y **`apps/mobile/components/ui/`**".

El repo resuelve la disputa sin ambigüedad: `apps/mobile/components/ui/` tiene 26 primitivos (`Button.tsx`, `Card.tsx`, `Input.tsx`, …) y `apps/mobile/components/` no tiene **ningún** `.tsx` suelto — sólo carpetas por feature (`accounts/`, `auth/`, `cards/`, …) más `ui/`. `ui-foundations` tiene razón; `repo-architecture` está mal.

El error viene de arrastre: ambos requirements convivían en `project-conventions`, donde la contradicción estaba en un solo archivo y era fácil de ver. `split-project-conventions` los mandó a capabilities distintas —correctamente, son temas distintos— y con eso convirtió una inconsistencia visible en dos contratos autoritativos que se contradicen sin saberlo. Aquel change se prohibió explícitamente editar contenido, así que dejó la corrección anotada como deuda; esta change la paga.

El síntoma más concreto: un scenario de `repo-architecture` afirma que TypeScript marcará un error en `apps/mobile/components/Button.tsx`. **Ese archivo no existe.** El archivo real es `apps/mobile/components/ui/Button.tsx`. Un scenario que nombra una ruta inexistente no es verificable, y una IA o un colaborador nuevo que siga `repo-architecture` al pie de la letra creará el primitivo en el lugar equivocado.

## What Changes

- **Se corrige la cláusula de ubicación** en el requirement "La paridad web↔mobile se sostiene por contratos de props compartidos": `apps/mobile/components/` pasa a `apps/mobile/components/ui/`.
- **Se corrige la ruta del scenario** "Una prop nueva en el contrato obliga a mobile a implementarla": `apps/mobile/components/Button.tsx` pasa a `apps/mobile/components/ui/Button.tsx`, que es el archivo que existe.
- **Se agrega una cláusula de deslinde** que nombra a `ui-foundations` como la fuente de verdad sobre las capas de componentes y sus ubicaciones. `repo-architecture` habla de la política de paridad entre plataformas, no del layout del design system; apuntar al dueño evita que las dos capabilities vuelvan a divergir en silencio.

No cambia ninguna regla de comportamiento: la política de dos implementaciones nativas con contrato de props compartido queda intacta. Sólo se corrige **dónde** dice que viven los archivos, para que coincida con el repo y con la capability que gobierna el tema.

No es **BREAKING**. Ningún código cambia; el código ya está en la ubicación correcta. Lo que se corrige es la spec que lo describía mal.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `repo-architecture`: cambia el requirement "La paridad web↔mobile se sostiene por contratos de props compartidos" — la ruta de los primitivos mobile, la ruta del archivo en un scenario, y una cláusula nueva que deslinda la propiedad del tema hacia `ui-foundations`.

## Impact

- **Código**: ninguno. `apps/mobile/components/ui/` ya contiene los 26 primitivos; la spec era lo único desalineado. No se toca `apps/`, `packages/`, `supabase/migrations/` ni tests.
- **Datos**: ninguno. No hay migraciones.
- **Specs**: 1 capability tocada (`repo-architecture`), 1 `MODIFIED`. `ui-foundations` NO se toca: ya dice lo correcto.
- **Riesgo**: muy bajo. La corrección es verificable contra el filesystem y no hay lectura alternativa: no existe ningún `.tsx` suelto en `apps/mobile/components/`.
- **Solapamiento con changes activas**: ninguno. La única change activa es `cards-mobile-density`, que toca `cards`.
