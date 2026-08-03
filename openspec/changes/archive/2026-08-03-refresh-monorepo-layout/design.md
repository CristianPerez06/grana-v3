# Diseño — actualizar el layout del monorepo

## Context

Este requirement se desactualizó de la peor forma posible para una spec: no quedó ambiguo ni contradictorio, quedó **confiadamente equivocado**. Afirma que la app actual es `apps/web/` y que `apps/mobile/` es hipotética, con un tono tan definido como el del resto del texto. Una IA o un colaborador nuevo que lo lea no tiene señal de que esa parte no es de fiar.

La deuda venía anotada desde `split-project-conventions`, que se prohibió editar contenido y sólo pudo registrarla.

## Goals / Non-Goals

**Goals:**

- Que lo que el requirement afirma sobre el repo sea verificable contra el filesystem hoy.
- Que deje de desactualizarse por la misma causa.
- Conservar intactas las reglas de comportamiento: frontera `apps/`↔`packages/`, prohibición de código en la raíz, criterio de promoción a paquete.

**Non-Goals:**

- Cambiar la política de qué va en `apps/` vs `packages/`.
- Documentar cada paquete. Eso es trabajo de cada `package.json` y su README, no de una spec de arquitectura.
- Tocar `pnpm-workspace.yaml`, código o tests.

## Decisions

### Decisión 1 — Se elimina el inventario de paquetes en vez de actualizarlo

La corrección obvia era reemplazar los cuatro nombres por los catorce actuales. Se descarta: reproduce exactamente la condición que produjo el error. Una lista literal dentro de un texto normativo no tiene ningún mecanismo que la obligue a seguir al repo, y nadie que agregue el paquete quince va a acordarse de venir acá.

El requirement pasa a describir **familias** de paquetes con ejemplos marcados como ejemplos, y declara explícitamente que la lista autoritativa es `packages/` más los globs de `pnpm-workspace.yaml`. La spec deja de competir con el filesystem por ser la fuente de verdad de algo que el filesystem ya responde mejor.

Las tres familias que se nombran —dominio/feature, cross-cutting, design system— describen el corte que el repo ya tiene: siete paquetes de área de producto, cinco de infraestructura transversal, dos de design system.

**Alternativa descartada:** sacar toda referencia a paquetes concretos. Se descarta porque los ejemplos son lo que hace legible la distinción entre familias; el problema nunca fue nombrar paquetes, fue presentarlos como censo.

### Decisión 2 — Un scenario ejerce la regla de no-inventario

Decir "esta spec no mantiene un índice" es una intención hasta que algo la verifica. El scenario "Un paquete nuevo no obliga a editar esta spec" la convierte en una afirmación comprobable: si alguien agrega un paquete y tiene que venir a editar este requirement, el scenario falla y la decisión de diseño se rompió.

### Decisión 3 — `tsconfig.base.json` pasa de condicional a afirmación

El texto decía "`tsconfig.base.json` si se usa una base compartida". El condicional era razonable cuando se escribió y hoy sólo agrega ruido: el archivo existe en la raíz y lo usan apps y paquetes. Una spec que hedgea sobre un hecho observable le traslada al lector la tarea de ir a verificar.

## Risks / Trade-offs

- **Menos detalle sobre qué paquetes existen.** Es deliberado. Quien necesite la lista tiene `ls packages/`, que nunca miente; quien necesite entender la organización tiene las tres familias, que cambian mucho más despacio que los nombres.
- **Las familias también pueden envejecer.** Si aparece una cuarta categoría, la descripción queda corta. El riesgo es mucho menor que el del inventario —una familia nueva es un evento raro, un paquete nuevo no— y el scenario de no-inventario limita el daño: un paquete que no encaje claramente en ninguna familia sigue estando cubierto por el patrón general.
- **Los tres ejemplos por familia son, técnicamente, un mini-inventario.** Se acepta: están marcados como ejemplos y la spec dice de dónde sacar la lista real, así que envejecen sin volverse falsos — un `@grana/accounts` que dejara de existir haría el ejemplo obsoleto, no la regla.
