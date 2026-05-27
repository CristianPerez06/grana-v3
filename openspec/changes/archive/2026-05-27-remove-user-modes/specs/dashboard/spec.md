## MODIFIED Requirements

### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

(MODIFICA el mismo requirement: se elimina toda referencia a modos `novato`/`experto`. Hay una sola experiencia de dashboard. Los escenarios que distinguían "Usuario novato aterriza" / "Usuario experto aterriza" / "Dashboard se ve igual en novato y experto" se colapsan en un único escenario. También se ajusta el `Purpose` del master spec, que dice "idéntica para modo novato y experto".)

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding.

#### Scenario: Usuario aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding
- **THEN** el sistema lo redirige a `/dashboard`
- **AND** la pantalla renderiza las tres secciones (Hero, Lo que viene, Balance del mes) en orden fijo

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

(MODIFICA el mismo requirement: se elimina la cláusula "El layout NO SHALL depender del modo (`novato`/`experto`)", que pierde sentido al no haber modos.)

En viewports `lg` (≥1024px) y mayores, la pantalla `/dashboard` web SHALL reorganizar sus secciones en un layout multi-columna en lugar de la columna única mobile-first: el Hero ocupa el ancho completo arriba; debajo, "Balance del mes" y "Lo que viene" se muestran lado a lado, con "Balance del mes" creciendo para ocupar el ancho disponible y "Lo que viene" como rail de ancho acotado a la derecha. Ambas columnas SHALL igualar su altura. Por debajo de `lg`, el dashboard SHALL mantener la columna única mobile-first.
