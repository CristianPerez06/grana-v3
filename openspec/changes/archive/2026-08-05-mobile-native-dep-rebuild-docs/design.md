# Design: mobile-native-dep-rebuild-docs

## Context

Change de documentación. No toca código de la app: corrige `apps/mobile/README.md` y agrega un requirement a `mobile-app-shell`.

El disparador fue un episodio real (5-ago-2026) donde tres errores se encadenaron a partir de una sola convención no escrita:

1. `The package 'react-native-keyboard-controller' doesn't seem to be linked` — el binario instalado se había compilado antes de que existiera la dependencia.
2. Al verificar `apps/mobile/node_modules/react-native-keyboard-controller` no aparecía nada (correcto bajo `nodeLinker: hoisted`, que instala en la raíz), se leyó como install roto → `rm -rf node_modules && pnpm install` innecesario.
3. Ese borrado dejó el file map de Metro apuntando a inodos que ya no existían → `Failed to get the SHA-1 for: …`.

Ninguno de los tres es un defecto del código. Los tres son consecuencia de convenciones que el repo aplica pero no documenta.

## Goals / Non-Goals

**Goals:**

- Que el error de linking se resuelva leyendo el README, sin re-derivar el diagnóstico.
- Que la tabla de scripts diga lo que los scripts hacen.
- Que el layout `hoisted` deje de leerse como install roto.
- Que la regla sobreviva a una reescritura del README (de ahí el requirement).

**Non-Goals:**

- **No** se agregan perfiles de EAS ni se cambia el flujo de builds. `EAS_SETUP.md` sigue siendo la fuente para distribución.
- **No** se automatiza la detección (un hook que avise "cambió una dep nativa, rebuildeá"). Es tentador, pero el disparador correcto es difícil de detectar sin falsos positivos, y la regla escrita cubre el caso.
- **No** se toca `metro.config.js`: ya resuelve bien ambas rutas de `node_modules`; no fue parte del problema.

## Decisions

### 1. La regla va en el README **y** en la spec

El README es donde alguien mira cuando la app no arranca; la spec es lo que sobrevive a la próxima reescritura del README. Duplicar una regla de dos líneas es barato comparado con volver a perder media tarde.

Alternativa considerada: solo README. Se descarta porque este README ya se desactualizó exactamente así — los scripts cambiaron a `run:ios`/`run:android` y la tabla quedó describiendo los viejos `expo start`.

### 2. Tabla de síntoma → causa → fix, no prosa

Los tres errores del episodio tienen mensajes distintos y causas distintas, y dos de ellos (`SHA-1`, `Unable to resolve module`) parecen "algo se rompió" sin pista de por dónde empezar. Una tabla indexada por el texto del error es lo que se puede grepear cuando la terminal ya escupió el mensaje.

### 3. El aviso sobre `hoisted` se repite en el README de mobile

`pnpm-workspace.yaml` ya documenta `nodeLinker: hoisted` y su consecuencia para `apps/web`. Aun así se repite en el README de mobile, porque el momento en que hace falta saberlo es cuando estás debuggeando un módulo que no resuelve — y nadie abre `pnpm-workspace.yaml` en ese momento.

## Risks / Trade-offs

- **[La documentación se vuelve a desactualizar]** → Es el riesgo de fondo, y por eso la regla queda además como requirement. El requirement no se puede editar sin pasar por un change, que es justamente el checkpoint que faltó cuando los scripts cambiaron.
- **[Duplicación entre README, spec y `pnpm-workspace.yaml`]** → Aceptada y acotada: la spec fija la regla, el README explica cómo aplicarla, `pnpm-workspace.yaml` documenta el porqué del layout. Cada uno se lee en un momento distinto.
