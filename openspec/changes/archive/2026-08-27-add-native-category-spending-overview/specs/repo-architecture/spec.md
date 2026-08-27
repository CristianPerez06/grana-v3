## ADDED Requirements

### Requirement: El package destino de un read compartido lo decide el grafo de dependencias

El requirement *"La lógica isomórfica vive en el package de dominio; sólo el glue acoplado a plataforma queda por app"* resuelve **si** un read sale de `apps/` a `packages/`. Cuando hay más de un package candidato, la elección NO SHALL hacerse por afinidad temática con reads vecinos, sino por el **grafo de dependencias entre packages**, que SHALL permanecer **acíclico**.

La regla:

- Un read SHALL vivir en el package **más superficial** que ya provee todo lo que ese read necesita (helpers, tipos, constantes de select). "Más superficial" = el que está más cerca de las hojas del grafo, para no arrastrar dependencias nuevas hacia los packages base.
- Un read NUNCA SHALL colocarse en un package que lo obligue a **invertir o duplicar una arista existente** del grafo. Si ubicarlo en el package temáticamente obvio crearía un ciclo, el ciclo gana: el read va al otro lado de la arista.
- Cuando esa restricción **separa reads que conceptualmente son una familia** (p. ej. un desglose y la lista que lo compone), la separación SHALL documentarse en el spec del dominio afectado, con la arista que la fuerza nombrada explícitamente. Sin esa nota, el próximo colaborador reintenta la agrupación temática y vuelve a chocar con el ciclo.
- La aristas del grafo SHALL declararse en los `package.json` de los packages. Un import que no corresponda a una dependencia declarada NO SHALL introducirse "porque el bundler lo resuelve".

Los tests que sólo ejercitan lógica pura (los que importan de `@grana/money-logic` y replican loops de producción sobre filas sintéticas) NO SHALL considerarse acoplados al package donde vive el read que protegen: SHALL poder quedarse donde están cuando el read se mueve, y moverse sólo por vecindad de lectura.

#### Scenario: Un read va al package que el grafo permite, no al temáticamente obvio

- **WHEN** un colaborador extrae un read que necesita helpers de `@grana/transactions` y quiere ubicarlo junto a sus reads hermanos en `@grana/dashboard`
- **AND** `@grana/transactions` ya declara una dependencia sobre `@grana/dashboard`
- **THEN** ubicarlo en `@grana/dashboard` se rechaza porque cerraría el ciclo `dashboard → transactions → dashboard`
- **AND** el read va a `@grana/transactions`, del lado de la arista que ya existe

#### Scenario: Una familia de reads partida entre packages queda documentada

- **WHEN** el grafo obliga a separar un desglose (`@grana/dashboard`) de la lista que lo compone (`@grana/transactions`)
- **THEN** el spec del dominio nombra la separación y la arista que la fuerza
- **AND** no queda como decisión implícita que un colaborador futuro lea como inconsistencia

#### Scenario: Un test de lógica pura no sigue al read que protege

- **WHEN** un read se mueve de un package a otro y su test invariante sólo importa de `@grana/money-logic`
- **THEN** el test NO necesita moverse: no depende del package del read
- **AND** si se mueve, es por vecindad de lectura y no por una dependencia rota
