# Referencias de diseño — Dashboard (desktop + mobile)

> ⚠️ **Material no-autoritativo.** Estos archivos son mockups generados en
> [Paper](https://paper.design) (archivo **"Grana V3 — Desktop"**). Son referencia
> de **intención visual y layout**, NO la implementación.
>
> - Usan **hex literales** (`#10B981`, `#0B1A2B`, `#B56A5A`, …), **no** los tokens de
>   `@grana/ui-tokens`. Al implementar, traducir a clases de token (`bg-emerald`,
>   `text-navy`, `border-border`, …), nunca copiar los hex.
> - Usan **datos de ejemplo** (montos, nombres de cuentas/tarjetas, fechas).
> - El markup es un volcado de Paper: estructura única, sin separar web (HTML) de
>   mobile nativo (React Native). La implementación real son componentes por
>   plataforma con contracts en `@grana/ui-contracts` y lógica pura en
>   `@grana/money-logic`.
>
> **Fuente de verdad:** tokens (`@grana/ui-tokens`) + specs (`openspec/specs/`) +
> código (`apps/web`, `apps/mobile`). Si algo acá contradice esos, ganan esos.

## Pantallas

| Pantalla | Vista | PNG | Markup |
|----------|-------|-----|--------|
| Dashboard | Web desktop (1440) | `dashboard-desktop.png` | `markup/dashboard-desktop.svg` · `markup/dashboard-desktop.jsx` |
| Cards | Web desktop (1440) | `cards-desktop.png` | `markup/cards-desktop.svg` |
| Dashboard | Web mobile (~390, en navegador) | `dashboard-web-mobile.png` | `markup/dashboard-web-mobile.svg` |
| Dashboard | App nativa (Expo, 390×844) | `dashboard-mobile-app.png` | `markup/dashboard-mobile-app.svg` |

> La página **Cards** se incluye como contexto (a dónde se mudan las tarjetas), pero
> su implementación NO es parte de este change. Tampoco lo son los overlays de
> navegación (drawer del web-mobile, `AppMenu` del nativo) ni la pantalla Cards mobile.

## Formatos

- **`.png`** — captura a 2x. Lo más rápido para entender el layout de un vistazo.
- **`.svg`** — vector fiel (colores y posiciones exactos), abre en cualquier browser.
  Es markup (XML) pero asset de diseño, no se copia como componente.
- **`.jsx`** — volcado de Paper en JSX con clases Tailwind. Solo se incluye el del
  **dashboard desktop** como muestra representativa del "componente". Sirve para leer
  valores y estructura; recordar el aviso de hex/tokens de arriba. Si hace falta el
  JSX de las otras pantallas, se puede regenerar desde Paper.

## Decisiones de layout capturadas

- **Desktop**: reflow multi-columna por encima de `lg` (1024px). Hero ancho arriba;
  debajo `Balance del mes` (izq, crece) + rail `Lo que viene` (der) con alturas
  igualadas. Header con saludo + `eye toggle` + botón "Nuevo movimiento".
- **Sidebar**: logo header fijo, nav central scrolleable, Configuración + Cerrar
  sesión como footer sticky.
- **Mobile (ambas variantes)**: columna única, **sin** sección Tarjetas. Web-mobile =
  topbar blanca con hamburguesa + drawer. Nativa = header navy + tab bar (Inicio,
  Movimientos, Hogar disabled, Menú); Tarjetas vive en el `AppMenu`.
