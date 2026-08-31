# Proposal: extract-savings-module

> **Estado: propuesto.** Prerrequisito de la fase 3 del modelo de dinero.
>
> Vive en `feature/add-savings-set-aside`, la **branch de integración del modelo**. Las dos
> compuertas de las fases 1 y 2 siguen valiendo: no se archiva hasta el QA nativo
> ([#58](https://github.com/CristianPerez06/grana-v3/issues/58)) y no se mergea hasta que las fases
> completen el modelo.
>
> **QA nativo CORRIDO (29-ago-2026).** 13 de los 14 casos de `docs/qa-savings-nativo.md` en verde,
> en simulador y en un iPhone 16 Pro real. El caso 11 —el teclado sobre el botón de confirmar— quedó
> **aceptado sin correr, por excepción escrita** en ese doc: se explica por qué no se pudo probar, qué
> se estaría llevando puesto si falla, por qué el riesgo es bajo y qué lo reabre. La compuerta de QA
> queda **levantada**; la de mergear con el modelo completo sigue valiendo.

## Why

Las fases 1 y 2 están construidas y **no tienen puerta**. Al guardado se llega tocando un número en
la card de saldo del dashboard; a los propósitos, tocando otro número adentro de ese overlay. No hay
ruta, no hay entrada de menú, no hay nada que se pueda linkear ni encontrar buscando.

Eso ya es un problema de uso. Pero el que fuerza este change es otro, y es de producto:

**Sin borde, la funcionalidad no se puede sacar.** Tres fases seguidas agregaron piezas a pantallas
que ya existían: una fila en la card de saldo, una tira post-ingreso, un desglose adentro de un
drawer, y —en el diseño de la fase 3— una acción en el detalle de cuenta. Ninguna es grave sola.
Juntas **ya son un módulo, construido de la peor manera**: sin nombre, sin límite, y sin poder
ocultarlo para quien no lo usa ni ponerlo detrás de un plan.

Esa decisión se toma una vez, casi sin darse cuenta, cada vez que se agrega una fila a una pantalla
ajena. Este change la revierte antes de que la fase 3 la haga irreversible.

### Por qué el modelo no lo impedía

`docs/modelo-de-dinero.md` dice: *"Ahorro e inversión no son dimensiones. Son resultados de ejercer
las otras. Por eso **nunca fueron dos módulos**."*

Esa frase es sobre **el modelo de datos**: no hay que construir un universo de tablas "ahorro" y otro
"inversión" que dupliquen el modelo de plata. Sigue valiendo entera. **No dice nada sobre la
navegación**, y se estuvo usando para bloquearla.

La otra objeción del documento —*"una superficie llamada «Invertir» deja afuera al acto de protección
más común del país, que es comprar dólares"*— es contra la palabra **«Invertir»**, no contra la
existencia de un módulo. *Ahorro e inversión* no tiene ese problema: comprar dólares para cubrirse es
ahorro en el sentido que le da cualquier argentino.

Y `AGENTS.md` ya lista **`16 savings`** y **`18 investments`** como módulos. Siempre lo fueron en el
código; lo único que les falta es la puerta.

## What Changes

**Ninguna funcionalidad financiera nueva.** El change es de navegación, composición y jerarquía.

- **Una entrada de navegación nueva**: *Ahorro e inversión*.
- **Una vista de módulo**, por moneda (ARS/USD, nunca sumadas): la foto —*Para gastar* y
  *Guardado*— y el bloque de guardado completo, con el desglose *¿Para qué?*, los propósitos,
  «Sin destino» como resto derivado, y las acciones **Guardar · Volver a usar · Destinar**.
- **El dashboard conserva una lectura mínima** de Guardado, porque explica el disponible, y **pierde
  la operatoria**: deja de ser la casa.
- **Cuentas y Movimientos no ganan nada.** Cuentas sigue siendo ubicación física; guardar y destinar
  siguen fuera del ledger.
- **La corrección documental** de `docs/modelo-de-dinero.md`, separando *"no son dos modelos de
  datos"* de *"no son un lugar en la app"*.

### Lo que NO entra

Plazo fijo · FCI · bróker · comprar dólares desde el módulo · un bloque «A resguardo» activo ·
**CTAs deshabilitados o placeholders de inversiones**. Un módulo que se estrena mostrando lo que
todavía no hace enseña a ignorarlo.

## Impact

- **Capability**: `savings` (modificada). No se toca `dashboard` más que para quitarle operatoria.
- **Sin migraciones.** `availability_reserve`, `savings_purpose_allocation`, los invariantes y el
  write path se reutilizan tal cual.
- **Dependencia**: la fase 3A (plazo fijo) se construye **adentro** de este módulo, y por eso va
  después.
