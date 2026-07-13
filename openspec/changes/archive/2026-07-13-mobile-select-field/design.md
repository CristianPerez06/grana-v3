# Design — mobile-select-field

## Contexto

El form de alta ya funciona; esto es puro refactor de presentación de dos campos (cuenta, categoría). El patrón destino ya existe dos veces en mobile: `BankSelector` (trigger-row con `ChevronDown`) + su modal interno (`formSheet` con `FlatList`, header con título+cerrar, footer con acción, y swap a un sub-view). Se destila ese patrón a primitivos reusables y se aplica al form. Cero lógica de negocio nueva.

## Decisión 1 — Dos primitivos, no uno

`SelectField` (trigger) y `SelectSheet` (modal) se separan porque el trigger vive inline en el form y el sheet es un overlay; además hay 4 triggers pero cada uno abre su propio sheet. Firma pensada para reuso, no sobre-abstracción:

```
SelectField: { label?, placeholder, value?: ReactNode (avatar+primario+secundario), onPress, invalid? }
SelectSheet<T>: { visible, onClose, title, items: T[], keyExtractor, renderRow: (item, isSelected)=>node,
                  selectedId?, header?: ReactNode, footer?: ReactNode }   // header = slot de drill/volver
```

`SelectSheet` sólo posee el shell (Modal `formSheet` + header título/cerrar + slot `header` opcional + `FlatList` + slot `footer`). El row-renderer lo pone el caller → soporta avatares, secundario y hint sin ramas internas. **Sin `TextInput` de búsqueda** (web no lo tiene; se omite deliberadamente).

## Decisión 2 — Consumers finos, drill afuera del shell

- `AccountSelectField` — compone `SelectField` + `SelectSheet` con lista plana de cuentas; fila = avatar + institución/nombre + hint credit + ✓. Reemplaza los 3 usos (origen, destino, acreditación).
- `CategorySelectField` — maneja el estado de drill (`catDrill`) y **pasa distintos `items` al mismo `SelectSheet`** según el nivel (categorías vs. subcategorías de la drilleada), con el slot `header` renderizando el botón "volver" + nombre de la categoría en el nivel drilleado. Es el mismo truco de swap que `BankSelector` usa para su form de institución custom — no se mete drill genérico dentro de `SelectSheet`.

## Decisión 3 — Drill de categoría: espejo exacto del web

Web (`movement-form.tsx`, `categoryPickerContent`):
```
nivel 0:  cada categoría; con subcats → chevron (abre drill); sin subcats → selecciona con ✓.
          (el footer "＋ Agregar nueva categoría" del web se descartó a pedido del usuario — el picker no navega fuera del form).
nivel 1:  volver (‹ + nombre categoría) → "Toda la categoría" (pickCategory(id,'')) → subcats (pickCategory(id,sub)) con ✓.
trigger:  "Categoría › Subcategoría" (subcategoría en text-muted).
```
i18n ya existe: `drawer.whole_category`, `drawer.add_new_category`, `placeholders.category`. El wire de selección sigue siendo `form.pickCategory(catId, subId)` / `form.categoryId` / `form.subcategoryId` — el hook no cambia.

## Decisión 4 — Retirar `PickRow`, target como radio (revisado en apply)

Tras migrar cuenta y categoría, el único uso restante de `PickRow` es el destino del reintegro (2 opciones). La intención declarada era pasarlo a `Segmented`, **pero en el apply se descartó**: los labels del target son frases largas ("A una cuenta — el banco te deposita la plata" / "En el resumen — se descuenta de la tarjeta") que en un `Segmented` de 2 opciones se apretujan y wrapean feo. Se deja como **radio vertical** (el control correcto para labels largos, y lo que usa web). `PickRow` se reemplaza por un `RadioRow` slim (sólo `label`/`selected`/`onPress`, sin `secondary`/`hint`/`compact`), usado únicamente por el target.

## Decisión 5 — i18n mínimo

Reusar todo lo existente; agregar sólo `transactions.placeholders.account` ("Seleccioná una cuenta" / "Select an account") para el placeholder del trigger de cuenta. Los títulos de sheet reusan las labels de campo (`form.account_label`, `form.destination_label`, `form.category_label`).

## Riesgos / notas

- **Avatar en filas**: `MovementFormAccount.avatar` es `ResolvedAccountAvatar` — reusar `AccountAvatar` (ya en `components/ui/`), igual que hoy en otras pantallas. Las credit ya traen avatar resuelto (B.2a).
- **Sin tests nuevos de negocio**: no hay lógica; el hook y las cascadas ya están cubiertos. Verificación = typecheck + lint + smoke (abrir cada picker, elegir, ver el trigger actualizado; drill de categoría; reintegro target en `Segmented`).
- **B.2b** reusará `AccountSelectField` para exchange/ajuste; queda como consumidor futuro, no se fuerza ahora.
