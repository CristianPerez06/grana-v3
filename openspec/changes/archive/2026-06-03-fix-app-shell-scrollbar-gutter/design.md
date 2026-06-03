## Context

`apps/web/app/(app)/_components/app-shell.tsx:82` actualmente renderiza:

```tsx
<main className="mx-auto w-full max-w-5xl flex-1 px-8 py-8 md:overflow-y-auto">
  {children}
</main>
```

Un solo elemento concentra tres responsabilidades:

1. **Region semantic** (`<main>`).
2. **Viewport de scroll** (`md:overflow-y-auto`).
3. **Width cap + horizontal padding** (`mx-auto w-full max-w-5xl px-8`).

Como el scrollbar se pinta en el borde derecho del elemento scrolleable, y ese elemento está centrado con un ancho máximo de 1024px, en monitores anchos el scrollbar queda visualmente al medio-derecha del viewport, con una franja muerta entre él y el borde derecho.

```
┌──────────────────────── viewport ─────────────────────────┐
│         │                                       │         │
│ sidebar │       <main max-w-5xl scrolls>      ▌ │  dead   │
│         │           contenido                 ▌ │  zone   │
│         │                                       │         │
└─────────┴───────────────────────────────────────┴─────────┘
                                      scrollbar pegado al cap
```

## Goals / Non-Goals

**Goals:**

- El scrollbar vertical aparece pegado al borde derecho del viewport en todas las rutas autenticadas.
- El cap de ancho de contenido (`max-w-5xl`) y el centrado se preservan exactamente como hoy.
- La spec `web-app-shell` documenta la separación entre viewport de scroll y contenedor de ancho para que futuros refactors no la rompan.

**Non-Goals:**

- Cambiar el valor del ancho máximo (`max-w-5xl` se mantiene).
- Cambiar el padding horizontal/vertical del área de contenido (`px-8 py-8` se mantiene).
- Tocar sidebar, drawer mobile, topbar mobile o el overflow del body / html.
- Estilizar el scrollbar (color, ancho, gutter), o forzar `scrollbar-gutter: stable`.
- Cambiar el comportamiento de `position: sticky` de descendientes (siguen quedando dentro del mismo subárbol que scrollea).

## Decisions

### Decision: Split en `<main>` (viewport) + `<div>` (width cap)

```tsx
<main className="flex-1 md:overflow-y-auto">
  <div className="mx-auto w-full max-w-5xl px-8 py-8">
    {children}
  </div>
</main>
```

`<main>` queda full-width y dueño del overflow. Un wrapper interno absorbe `mx-auto w-full max-w-5xl px-8 py-8`. El scrollbar pasa a pintarse en el borde derecho del `<main>`, que coincide con el borde derecho del viewport (porque el sidebar es el único otro hermano en el flex row).

**Por qué este patrón y no otros:**

- *Body scroll (mover overflow al `<html>`/`<body>`)*: rompería el sidebar fijo, que hoy depende de `md:overflow-hidden` en el contenedor flex padre. Cambio mucho más invasivo.
- *`scrollbar-gutter: stable both-edges` en el `<main>` actual*: reserva un gutter simétrico pero no mueve el scrollbar; sigue dentro del bloque capado. No resuelve el problema.
- *Estilizar scrollbar como overlay (`scrollbar-width: thin` + colores transparentes)*: oculta el síntoma en macOS, pero en Windows / Linux con scrollbar clásico el problema persiste.

### Decision: Padding se traslada al wrapper interno

`px-8 py-8` se mueve al `<div>` interior. Si quedara en `<main>`, el scrollbar viviría pegado al borde derecho del padding del `<main>`, no del viewport; el padding horizontal externo del `<main>` empujaría el scrollbar hacia adentro.

### Decision: No tocar `<main>` como landmark semántico

Mantener el `<main>` como el elemento que recibe el role implícito de `main`. El wrapper interior es un `<div>` neutro sin role. Esto preserva accesibilidad sin cambios.

## Risks / Trade-offs

- **Descendientes con `position: sticky`** → el scroll container cambia de "el `<main>` capado" a "el `<main>` full-width", pero los descendientes siguen viviendo dentro del mismo subárbol que scrollea. El sticking se preserva. Mitigación: verificación visual en dashboard y en listas largas (movimientos, cuentas) antes de cerrar la rama.
- **Scrollbar superpuesto al área que antes era gutter derecho** → en Windows con scrollbar clásico, el scrollbar ahora ocupa píxeles que antes estaban vacíos entre el cap de contenido y el borde del viewport. No se superpone al contenido (sigue dentro de `max-w-5xl`), pero cambia la sensación visual respecto a hoy en ese SO. Aceptable: es justamente el resultado deseado.
- **Regresión silenciosa futura** → si alguien vuelve a colapsar viewport+cap en un mismo elemento, el bug reaparece. Mitigación: el requirement actualizado de la spec lo declara de forma explícita y agrega scenarios concretos (posición del scrollbar respecto al viewport).
