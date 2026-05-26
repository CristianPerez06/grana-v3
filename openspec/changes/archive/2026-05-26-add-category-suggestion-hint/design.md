# Design — Aviso pedagógico de categoría futura

## Contexto

La Capa 1 (`add-category-history-suggestion`) ya dejó cableado, en los dos forms de alta de movimientos, un lookup que corre en el blur de la descripción:

```
descripción (blur)
      │
      ▼
suggestCategoryFromHistory(description, type)   ← server action existente
      │
      ├── devuelve CategorySuggestion ──▶ se guarda en estado `suggestion` ──▶ chip (Capa 1)
      │
      └── devuelve null ────────────────▶ HOY: no pasa nada
```

Este cambio aprovecha la rama del `null`: cuando la descripción es **nueva** (no hubo coincidencia) y el usuario igual elige una categoría, mostramos el aviso. No hay consulta nueva: ya teníamos el resultado.

```
┌──────────────── Capa 1 (premio) ───────────────┐   ┌──────────── este cambio (promesa) ─────────────┐
│ hay coincidencia en historial                   │   │ NO hay coincidencia (descripción nueva)         │
│ + todavía no eligió categoría                    │   │ + el usuario eligió una categoría               │
│ → CHIP: "¿{cat}? · la última vez lo pusiste ahí" │   │ → AVISO: "la próxima vez te sugerimos {cat}"    │
└──────────────────────────────────────────────────┘   └──────────────────────────────────────────────────┘
                         mutuamente excluyentes — nunca aparecen juntos
```

## Goals / Non-goals

**Goals**
- Hacer visible la Capa 1 desde el primer movimiento, enseñando que la categorización se va a recordar.
- Dar un incentivo suave a escribir descripciones (alimenta la Capa 1).
- Cero costo de infraestructura: reusar el lookup existente, sin nuevas queries.

**Non-goals**
- No autocompleta ni cambia el guardado.
- No persiste preferencias ni "ya vi este aviso".
- No es un sistema de toasts/notificaciones global (queda inline).
- No toca mobile (transactions no existe ahí todavía).

## Decisiones

### D1 — Inline, no toast
El aviso se renderiza **dentro del formulario**, cerca del selector de categoría (debajo, donde la Capa 1 pone el chip). No introducimos infraestructura de toasts. Motivo: es contextual al acto de categorizar y desaparece naturalmente al guardar (redirect). Un toast sería más intrusivo y necesitaría andamiaje que no tenemos.

### D2 — Solo para descripciones nuevas (gated por el `null` del lookup)
El aviso se muestra **únicamente** cuando el lookup de la Capa 1 devolvió `null` para la descripción actual normalizada. Esto garantiza que la promesa es **verdadera**: como la Capa 1 sugiere por match exacto normalizado, si hoy no hay match, la próxima vez que se escriba esa misma descripción sí lo habrá (esta transacción). Si la descripción YA tenía historial, no mostramos el aviso (sería redundante: ya apareció el chip).

Consecuencia: chip y aviso son **mutuamente excluyentes** por construcción.

### D3 — Condiciones de aparición
El aviso aparece cuando se cumplen **todas**:
1. tipo `income` o `expense` (únicos con categoría),
2. la descripción es normalizable (mismas reglas que Capa 1: trim + lowercase, ≥2 chars),
3. el lookup del último blur devolvió `null` (descripción sin historial),
4. el usuario tiene una categoría elegida.

El orden entre "elegir categoría" y "blur de descripción" no importa: mientras (3) y (4) sean ciertos para la descripción actual, se muestra. Al cambiar la descripción (antes del próximo blur), se limpia el estado de "sin historial" para no afirmar algo todavía no verificado.

### D4 — Estilo sutil y tono pedagógico
Texto muteado, ícono suave, una línea. Nada de color de alerta. Pilar "enseña sin condescender": informa un beneficio futuro, no reprende ni exige. El componente es análogo a `CategorySuggestionChip` pero **no es accionable** (no hay nada que tocar): es puramente informativo.

### D5 — Copy (a refinar en implementación)
Clave i18n nueva `transactions.category_suggestion.hint`, con placeholders `{description}` y `{category}`. Borrador:
- ES: `La próxima vez que cargues «{description}» te vamos a sugerir «{category}».`
- EN: `Next time you log "{description}" we'll suggest "{category}".`
El wording exacto puede ajustarse al implementar; lo que el spec fija es el *significado* (anticipar la sugerencia futura), no la frase literal.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Ruido visual / cansa | Solo en descripciones nuevas + estilo sutil + se va al guardar. |
| Promesa falsa ("me dijo que iba a sugerir y no lo hizo") | Gated por el `null` del mismo lookup que después hará la sugerencia → match exacto normalizado coincide. |
| Confusión chip vs aviso | Mutuamente excluyentes por diseño (D2). |
| Descripción muy larga rompe el layout | Truncar/clamp en el componente (detalle de UI). |

## Alternativas descartadas

- **Capa 2 (diccionario de keywords)** para cubrir el cold-start: descartada por costo de mantenimiento, sesgo cultural y riesgo de adivinar mal (rompe confianza contable). Este aviso es la alternativa barata y on-pillar.
- **Toast global**: descartado (D1) — no hay infra y sería intrusivo.
- **Persistir "ya mostré el aviso"**: innecesario; el aviso es efímero y de bajo costo cognitivo.
