## Context

`packages/ui-tokens` es la única fuente de verdad de la paleta. Su `src/theme.css` declara un bloque `:root` con las custom properties (`--page`, `--navy`, `--border-soft`, …) y un `@theme` con los aliases de estilo shadcn cuyo valor es `var(--…)`. El codegen `scripts/codegen.mjs` parsea ese `:root` y genera `src/tokens.cjs`, que ambos apps consumen como `theme.extend.colors` de Tailwind.

Web recibe las variables porque importa `theme.css`. Mobile nunca las recibió: `apps/mobile/global.css` tiene sólo `@tailwind base/components/utilities`. Resultado: en RN, toda clase cuyo token sea un alias compila a `var(--…)` sin variable que la resuelva.

Restricciones que acotan el diseño:

- Mobile corre Tailwind v3 + NativeWind v4; web corre Tailwind v4 (CSS-first, sin `tailwind.config`). Las sintaxis no son intercambiables: `theme.css` usa `@custom-variant` y `@theme`, que Tailwind v3 no entiende. Mobile no puede importar `theme.css` tal cual.
- `apps/mobile/lib/colors.ts` ya existe como mirror JS manual de un subset de tokens, para los casos donde RN necesita el valor numérico (props `color`, `style` inline). Este change NO lo reemplaza.
- La app mobile es light-only (`userInterfaceStyle: "light"` en `app.json`), así que sólo hace falta el `:root`; el bloque `.dark` de `theme.css` queda fuera.

## Goals / Non-Goals

**Goals:**

- Que los aliases de `@grana/ui-tokens` resuelvan en React Native, sin tocar componentes.
- Que las variables de mobile se deriven de `theme.css` por codegen, no por una lista mantenida a mano que se desincronice.
- Dejar en spec quién pinta el fondo de la ventana en mobile, para que no vuelva el negro detrás del tab bar.

**Non-Goals:**

- Migrar las ~230 clases con alias a tokens estructurales (ver Decisión 1).
- Reemplazar `apps/mobile/lib/colors.ts` por el codegen TS de tokens. Es un trabajo distinto, ya anotado como pendiente en el header de ese archivo.
- Soporte de dark mode en mobile.
- Renombrar aliases o reorganizar la paleta en `theme.css`.

## Decisions

### Decisión 1: Declarar el `:root` en mobile, no migrar los usos

**Elegido:** extender el codegen para emitir un CSS con el `:root` de `theme.css`, e importarlo desde `apps/mobile/global.css`.

**Alternativa descartada:** migrar las 8 ocurrencias en uso (`text-primary` → `text-navy`, `text-muted-foreground` → `text-text-muted`) a tokens literales.

Razones:

- La migración arregla los 8 casos de hoy y deja el problema latente: el próximo alias que alguien escriba vuelve a fallar en silencio, sin que typecheck ni lint lo detecten.
- Declarar las variables cuesta un archivo generado y una línea de import, y cierra la clase entera de defectos.
- Preserva la simetría web↔mobile: la misma clase significa lo mismo en las dos plataformas, que es la premisa de `@grana/ui-tokens`. Migrar la rompe: obligaría a mantener en la cabeza qué subconjunto de la paleta es escribible en cada app.

**Costo aceptado:** el arreglo depende de que NativeWind resuelva `var()` contra un `:root` importado. Verificado offline (ver Riesgos).

### Decisión 2: Generar un CSS aparte en vez de hacer que mobile importe `theme.css`

El codegen SHALL emitir un archivo nuevo (por ejemplo `src/tokens.css`) que contenga **sólo** el bloque `:root`, sin `@custom-variant` ni `@theme`, y exportarlo desde el `package.json` del package. `apps/mobile/global.css` lo importa antes de las directivas `@tailwind`.

Importar `theme.css` directamente rompería: Tailwind v3 no entiende su sintaxis v4. Copiar las variables a mano en `global.css` funcionaría hoy y se desincronizaría en la primera edición de la paleta — exactamente el modo de falla que este change existe para cerrar.

### Decisión 3: El root layout pinta el fondo igual

Aunque las variables resuelvan, el `<View className="flex-1 bg-page">` del root sigue siendo necesario: el `TabBar` se monta como sibling del contenedor de pantallas del navigator, así que sus esquinas `rounded-t-xl` recortan sobre una zona que no pertenece a ninguna pantalla. Ninguna clase en ninguna pantalla puede pintar esa zona. Son dos defectos independientes con el mismo síntoma.

## Risks / Trade-offs

- **NativeWind podría no resolver `var()` desde un `:root` importado** → verificado offline: pasando el CSS compilado de mobile por `react-native-css-interop/dist/css-to-rn`, el `:root` importado produce `rootVariables` (13 variables, las referenciadas por las clases en uso) y las reglas con alias quedan como instrucciones `var()` que resuelven contra ellas. Queda pendiente la confirmación visual en emulador.
- **`postcss-import` no lee el mapa `exports` del `package.json`** → por eso el CSS generado se emite en la **raíz** del package y no en `src/`: así `@grana/ui-tokens/tokens.css` resuelve tanto por exports (bundlers) como por ruta literal (postcss-import). Si alguien lo mueve a `src/`, el build de mobile falla con "Failed to find '@grana/ui-tokens/tokens.css'".
- **Las variables anidadas del `:root` se descartan** → `--background: var(--page)` y similares no sobreviven a la compilación de NativeWind. No está en el camino crítico: las clases de Tailwind referencian la variable **estructural** directamente (`bg-background` compila a `var(--page)`, no a `var(--background)`). Sólo importaría si algún día se escribiera `var(--background)` a mano en un estilo.
- **Verificación visual sólo en dispositivo** → `typecheck` y `lint` pasan con el bug presente y seguirán pasando después. Mitigación: ninguna automatizable hoy; la verificación la hace el usuario en el emulador.

## Migration Plan

Sin migración de datos ni rollback especial: el cambio es de estilos. Revertir es quitar el import de `global.css`.

## Open Questions

- ¿Conviene que el codegen emita también un `.dark` para cuando mobile soporte dark mode, aunque hoy no se use? Decisión diferida: hoy sería código muerto.
- `packages/ui-tokens/src/tokens.cjs` estaba **desactualizado** respecto de `theme.css`: correr el codegen agregó 27 líneas de tokens que nunca se habían regenerado (`hero-navy-*`, `terracotta-deep`, `slate-deep`, `income`, `expense`, `neutral-amount`). Sólo agregados, ningún valor existente cambió. ¿Vale la pena un chequeo en CI que falle si el codegen produce diff? Fuera del alcance de este change.
