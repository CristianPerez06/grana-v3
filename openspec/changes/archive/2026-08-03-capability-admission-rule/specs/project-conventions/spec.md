## ADDED Requirements

### Requirement: Una capability meta sólo admite requirements cuyo sujeto es el suyo

Grana tiene **capabilities meta**: las que aplican a todo el repo en vez de a un módulo de producto o a una plataforma. Hoy son tres, y cada una tiene un sujeto acotado:

| Capability meta | Su sujeto | Pregunta que responde |
| --- | --- | --- |
| `project-conventions` | El proceso de trabajo sobre el repo: idioma, control de versiones, workflow de OpenSpec, merge | "¿Cómo se trabaja en este repo?" |
| `repo-architecture` | El carveado del repo: layout `apps/`/`packages/`, frontera por acoplamiento a plataforma, política web↔mobile | "¿Dónde vive este módulo?" |
| `ui-foundations` | La base del design system: capas de componentes, tokens, composición de los primitivos base | "¿Qué compongo para construir esta pantalla?" |

Un requirement SHALL entrar a una capability meta **sólo si su sujeto es el sujeto de esa capability**. El sujeto de un requirement es aquello de lo que la regla habla, no el ámbito sobre el que se aplica: una regla sobre aritmética decimal habla de plata aunque aplique a todo el repo, y por lo tanto NO es meta.

Un requirement cuyo sujeto sea el **dominio del producto** (plata, cuentas, tarjetas, categorías, fechas contables), un **componente concreto**, o una **superficie de una plataforma** SHALL vivir en la capability de ese dominio.

**Meta no es lo mismo que cross-cutting.** `AGENTS.md` agrupa como "cross-cutting" a `schema-base`, `profiles`, `i18n` y `card-networks` junto a las tres capabilities meta, porque todas sostienen al resto del producto. Pero las primeras tienen un sujeto de dominio —el tipo `Money` y los catálogos de sistema, el perfil del usuario, la estrategia de i18n, las redes de tarjeta— y por lo tanto NO son capabilities meta ni admiten requirements ajenos a su sujeto. Que una capability aplique a todo el producto no la convierte en un destino válido por descarte.

**La ausencia de un hogar obvio NO SHALL ser razón para agregar un requirement a una capability meta.** Si la capability que le corresponde no existe todavía, SHALL crearse — con un `Purpose` real que declare su sujeto. Una capability nueva y estrecha es preferible a un requirement mal ubicado: lo primero se descubre por su nombre, lo segundo no se descubre nunca.

Preferir una capability existente sobre una nueva es una buena heurística **entre capabilities cuyo sujeto coincide con el del requirement**. NO SHALL leerse como preferencia por una capability meta: una capability meta acepta cualquier cosa por construcción, así que "ya existe y me deja entrar" no es evidencia de que sea el lugar correcto. Ese razonamiento es exactamente el que convirtió a `project-conventions` en un grab-bag de 835 líneas y 27 requirements, del que hubo que sacar 17.

El test de admisión SHALL ser: preguntar **"¿de qué habla este requirement?"**. La respuesta nombra la capability destino. Si la respuesta nombra dos cosas, probablemente son dos requirements.

#### Scenario: Una regla de proceso de trabajo entra a project-conventions

- **WHEN** un colaborador escribe un requirement sobre cómo se nombran las branches, en qué idioma se escriben los commits, o cómo se archiva una change
- **THEN** el requirement entra a `project-conventions`, porque su sujeto es el proceso de trabajo sobre el repo

#### Scenario: Una regla de dominio no entra a una capability meta aunque aplique a todo el repo

- **WHEN** un colaborador escribe un requirement sobre cómo se redondea un monto, cómo se deriva una fecha contable, o qué invariante cumple una tarjeta
- **THEN** el requirement NO entra a ninguna capability meta, aunque la regla aplique a todo el código
- **AND** entra a la capability del dominio del que habla (`schema-base`, `transactions`, `cards`, …)

#### Scenario: Un requirement sin hogar obvio crea su capability en vez de aterrizar en la meta

- **WHEN** un colaborador tiene un requirement cuyo sujeto no corresponde a ninguna capability existente
- **THEN** crea la capability de ese sujeto, con un nombre estrecho y un `Purpose` real que lo declare
- **AND** NO lo agrega a `project-conventions`, `repo-architecture` ni `ui-foundations` por descarte

#### Scenario: Una capability meta nueva declara su sujeto al nacer

- **WHEN** se crea una capability meta nueva
- **THEN** su `Purpose` declara explícitamente cuál es su sujeto y qué queda fuera
- **AND** este requirement se actualiza para incluirla en la tabla de capabilities meta
