## Context

Ver `proposal.md` — Why. Lo que importa acá es el estado del que se parte:

- El estado del mes ya está resuelto y **no se toca**: `DashboardMonthProvider` (web) y su espejo nativo exponen `{ selected, goPrev, goNext }`, arrancan en el mes de `getTodayAR()`, no persisten y no tocan la URL. Este cambio reemplaza **la superficie**, no el estado.
- El `MonthNavigator` es prop-driven y lo usan dos rutas: el dashboard y Movimientos. Solo el dashboard cambia.
- `formatTodayLine` ya existe en `@grana/dashboard` como función pura compartida, con tests. Es el lugar natural para la degradación por pasos.
- El repo prohíbe compartir JSX entre web y nativo: la paridad va por tipos en `@grana/ui-contracts` y lógica pura en packages. La hoja de meses son dos implementaciones con un contrato.
- Existe precedente de hoja: `SelectSheet` en nativo y los `Drawer` que debajo de `md` se presentan como bottom sheet en web.

## Goals / Non-Goals

**Goals:**

- Que la línea de la fecha sea el único punto de entrada al mes, en las dos plataformas.
- Que la degradación del texto sea una decisión explícita y testeable, no un `overflow` que corta donde caiga.
- Que el rango alcanzable (12 atrás, nada al futuro) se derive de una sola función pura y se muestre, no se descubra.
- Que el eye toggle cambie de lugar sin cambiar de comportamiento.

**Non-Goals:**

- Cambiar qué gobierna el selector, o el desfasaje M+1 de Compromisos. Ese contrato quedó fijado en `committed-outlook-follows-month` y acá solo se lo respeta.
- Tocar el `MonthNavigator` de Movimientos, ni borrarlo.
- Persistir el mes, mandarlo a la URL, o ampliar el rango más allá de 12 meses.
- Resolver el escalado de fuente con un `maxFontSizeMultiplier` global. Es una decisión de accesibilidad de toda la app, no de este change (ver Open Questions).

## Decisions

### 1. La lente es la línea de la fecha, no un control nuevo al lado

**Por qué:** el header ya gastaba ese renglón en una fecha. Convertirlo en control cuesta cero alto, y elimina la contradicción de que el header afirme dos tiempos distintos. Medido: parado en hoy el peor caso son 184px de los 288px disponibles a 320px en nativo — sobran 104px.

**Alternativas descartadas** (con el owner, sobre mockups a 360px reales): barra de lente permanente (~44px que el nativo ya tuvo y sacó), chip achicado en el header (sigue robándole ancho al nombre), y selector dentro de la card de saldo (gobierna tres bloques, meterlo en uno lo achica).

**Costo aceptado:** descubrimiento. Una fecha no se ve como un control. Se mitiga con un caret permanente, y la confirmación real es mirar a alguien usarla — está como tarea, no como supuesto.

### 2. Hoja de meses en lugar de flechas ±1

**Por qué:** las flechas son ~64px permanentes para mover un mes por toque; llegar al extremo del rango costaba once. La hoja da cualquier mes en uno y no se degrada si el rango crece. Además tiene lugar para nombrar el desfasaje de Compromisos, que hoy no se explica en ningún lado.

**Alternativa considerada:** conservar las flechas al lado de la línea cuando el usuario está fuera del mes corriente, para comparar meses consecutivos. **No entra en este change**: no sabemos si ese uso existe. Si aparece, se agrega después sin tocar la hoja.

**Forma:** grilla de meses agrupada por año, no lista vertical. Trece ítems en lista obligan a scrollear una hoja que de otro modo entra entera.

### 3. `formatTodayLine` pasa de "acortar" a "resolver la línea"

Hoy recibe `{ shortMonth }` y devuelve un string. Pasa a resolver los dos estados —fecha de hoy vs. mes seleccionado— y a exponer la **cadena de degradación** como datos: la función devuelve las variantes en orden de preferencia (completa, sin día de la semana), y cada plataforma elige la primera que entra.

**Por qué así y no medir dentro de la función:** medir texto es platform-specific (`measureText` en web, `onTextLayout` en nativo) y una función pura en un package no puede hacerlo sin acoplarse. La función decide **qué** variantes existen y en qué orden; la plataforma decide **cuál** entra. Así la regla de degradación es una sola, testeable sin DOM, y la medición vive donde puede vivir.

**Piso:** truncado con elipsis (`truncate` en web, `numberOfLines={1}` en nativo), que ya es la divergencia declarada de plataforma que el repo permite.

### 4. Contrato de la hoja en `@grana/ui-contracts`, meses alcanzables en `@grana/dashboard`

El cálculo de qué meses son elegibles es aritmética de calendario pura: entra en `@grana/dashboard` junto a `formatTodayLine`, con tests, y lo consumen las dos hojas. Las props de la hoja (`MonthSheetProps`) van a `ui-contracts` para que una divergencia entre plataformas rompa TypeScript del otro lado.

### 5. El eye toggle se muda sin cambiar

Cambia dónde se monta, no qué hace: sigue leyendo del mismo `EyeMaskProvider`, que sigue viviendo en el layout. La única consecuencia real es que **deja de depender del estado de carga del nombre del perfil** — dependencia que solo existía por estar en el header.

## Risks / Trade-offs

- **[La fecha no se lee como un control]** → Caret permanente junto al texto, más un área táctil de al menos 44px. La verificación es observar uso real, y está como tarea.
- **[La fila no entra con la fuente del sistema agrandada]** → Medido: rompe alrededor de 1.40× a 320px en nativo y 1.50× en web; de 360px para arriba aguanta 1.65× o más. Lo cubre la degradación por pasos, que es requirement. No se resuelve topeando el escalado (ver Open Questions).
- **[Las mediciones son de un mockup en Chromium, no de los componentes reales en RN]** → Verificación en dispositivos como tarea explícita y asignada, no como casilla asumida. Es la razón por la que este riesgo está escrito acá y no dado por resuelto.
- **[Se pierde el paso ±1]** → Aceptado a sabiendas. Reversible sin tocar la hoja si el uso aparece.
- **[Regresión en Movimientos por tocar `MonthNavigator`]** → No se toca el componente. El dashboard deja de importarlo; nada más cambia.
- **[La hoja nativa monta un `Modal` y rompe el teclado o el scroll]** → No tiene inputs, pero sí una grilla de `Pressable`. El spec `mobile-app-shell` es explícito: el scrim va como hermano detrás del panel, no como ancestro, o partes de la hoja scrollean y partes no. `MovementFiltersSheet` es la referencia a copiar.

## Migration Plan

Un solo commit por la política Web ↔ Mobile, sin flag ni fase intermedia: es un cambio de UI sin migración de datos y el rollback es revertir el commit. El `MonthNavigator` queda en el repo, así que revertir no arrastra nada.

El orden dentro del commit importa para no dejar el dashboard sin selector en ningún estado intermedio del branch: primero la aritmética y el formateo en `@grana/dashboard` con sus tests, después la hoja en las dos plataformas, después el header, y último la mudanza del eye toggle.

## Open Questions

- **¿Conviene topear el escalado de fuente en la app nativa** (`maxFontSizeMultiplier`)? Hoy no hay ninguno en `apps/mobile`. Es una decisión de accesibilidad de **toda** la app, no de esta pantalla, y responderla no cambia ni las specs ni las tareas de este change: la degradación por pasos hace falta igual. Merece su propio ticket.
- **¿La hoja debería recordar el año expandido** si algún día el rango crece a 24 meses? Con 13 meses entra entera y la pregunta no existe; con más, sí. Se responde cuando el rango cambie.
