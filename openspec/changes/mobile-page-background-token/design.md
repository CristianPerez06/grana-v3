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

**Alternativa descartada:** migrar las ~230 ocurrencias de `text-muted` → `text-text-muted`, `text-primary` → `text-navy`, `bg-background` → `bg-page`, etc.

Razones:

- Cuesta un archivo generado y una línea de import, contra ~100 archivos editados.
- No deja el problema latente: cualquier alias que alguien escriba mañana funciona, en vez de depender de que recuerde una lista de clases prohibidas.
- La migración además cambia colores de facto (hoy `text-muted` no pinta; migrarlo a `text-text-muted` haría que el texto secundario pase a gris), o sea que requiere revisión visual pantalla por pantalla. Declarar las variables produce el mismo cambio visual pero en un solo lugar y de una vez.
- Preserva la simetría web↔mobile: la misma clase significa lo mismo en las dos plataformas, que es la premisa de `@grana/ui-tokens`.

**Costo aceptado:** el arreglo depende de que NativeWind resuelva `var()` contra un `:root` importado. Ver Riesgos.

### Decisión 2: Generar un CSS aparte en vez de hacer que mobile importe `theme.css`

El codegen SHALL emitir un archivo nuevo (por ejemplo `src/tokens.css`) que contenga **sólo** el bloque `:root`, sin `@custom-variant` ni `@theme`, y exportarlo desde el `package.json` del package. `apps/mobile/global.css` lo importa antes de las directivas `@tailwind`.

Importar `theme.css` directamente rompería: Tailwind v3 no entiende su sintaxis v4. Copiar las variables a mano en `global.css` funcionaría hoy y se desincronizaría en la primera edición de la paleta — exactamente el modo de falla que este change existe para cerrar.

### Decisión 3: El root layout pinta el fondo igual

Aunque las variables resuelvan, el `<View className="flex-1 bg-page">` del root sigue siendo necesario: el `TabBar` se monta como sibling del contenedor de pantallas del navigator, así que sus esquinas `rounded-t-xl` recortan sobre una zona que no pertenece a ninguna pantalla. Ninguna clase en ninguna pantalla puede pintar esa zona. Son dos defectos independientes con el mismo síntoma.

## Risks / Trade-offs

- **NativeWind podría no resolver `var()` desde un `:root` importado** → el runtime de `react-native-css-interop` expone `rootVariables` y `universalVariables`, lo que indica que sí lo soporta, pero NO está verificado en dispositivo. Mitigación: la primera tarea del change es un espiga mínima (declarar una sola variable y verificar una clase alias en el emulador) antes de escribir el codegen. Si falla, se cae a la migración de la Decisión 1 y el resto del change no cambia.
- **El cambio visual es amplio y de golpe** → al resolver los aliases, ~230 textos que hoy caen al color default pasan a tomar `var(--border-soft)`, que es un color de **borde** (#EEF1F4), no de texto: casi ilegible sobre fondo claro. Mitigación: este change SHALL incluir la revisión de si esos usos querían `text-text-muted` y corregir el alias mal elegido donde corresponda. Es el mismo trabajo de la migración descartada, pero acotado a los usos que quedan mal, no a los ~230.
- **Verificación sólo en dispositivo** → `typecheck` y `lint` pasan con el bug presente y seguirán pasando después. Mitigación: ninguna automatizable hoy; la verificación la hace el usuario en el emulador.

## Migration Plan

Sin migración de datos ni rollback especial: el cambio es de estilos. Revertir es quitar el import de `global.css`.

## Open Questions

- ¿`text-muted` en los ~230 usos quería el color de texto secundario (`text-text-muted`, #6B7683) o alguien eligió el alias a conciencia? La lectura de los mocks en `docs/design/` sugiere lo primero, pero no está confirmado. Se resuelve al ejecutar el change, no antes.
- ¿Conviene que el codegen emita también un `.dark` para cuando mobile soporte dark mode, aunque hoy no se use? Decisión diferida: hoy sería código muerto.
