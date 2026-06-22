# guidance Specification

## Purpose
El módulo `guidance` es la capa de orientación contextual del usuario: muestra hints/guías inline (de un catálogo conocido por `guidance_id`, ej. `first_movement.type`) y persiste su ciclo de vida por usuario —visto (`seen_at`), descartado (`dismissed_at`) y completado (`completed_at`)— en `user_guidance_events` con RLS. Garantiza que una guía se muestre solo mientras no fue descartada ni completada, respeta el dismiss del usuario y permite disparar acciones objetivo (ej. "cargá tu primer movimiento"). El hook `useGuidance` es la interfaz de lectura/escritura para cualquier feature que consuma guías, desacoplando el onboarding y las ayudas no intrusivas de cada pantalla.

## Requirements
### Requirement: Sistema de persistencia de hints con granularidad clara

El sistema SHALL crear una tabla `user_guidance_events` que registra cuándo un hint fue visto (seen_at), dismissido (dismissed_at) o completado (completed_at). La tabla será la única fuente de verdad sobre qué guías ha visto el usuario. Cada hint (identificado por `guidance_id` de catálogo conocido) puede tener un único registro por usuario.

#### Scenario: Crear tabla user_guidance_events

- **WHEN** se migra la base de datos a esta versión
- **THEN** existe una tabla `user_guidance_events` con campos:
  - `id` (UUID, PK)
  - `user_id` (UUID, FK→profiles)
  - `guidance_id` (TEXT, enum from catalog: first_movement.type, etc.)
  - `seen_at` (TIMESTAMP, cuándo se renderizó realmente)
  - `dismissed_at` (TIMESTAMP NULL, cuándo el user hizo dismiss)
  - `completed_at` (TIMESTAMP NULL, cuándo se completó la acción objetivo)
  - `metadata` (JSONB, ej: {device: 'web', browser: 'Chrome'})
  - `created_at`, `updated_at`
- **AND** existe índice único en `(user_id, guidance_id)`
- **AND** RLS está habilitado: usuario solo puede SELECT/INSERT/UPDATE sus propios registros

#### Scenario: Consultar si hint debe mostrarse

- **WHEN** se renderiza un componente de hint con `guidance_id="first_movement.type"`
- **THEN** el hook `useGuidance('first_movement.type')` consulta la tabla para ese user
- **AND** retorna `{ seen_at, dismissed_at, completed_at, isVisible }`
- **AND** `isVisible` es `true` si `dismissed_at IS NULL AND completed_at IS NULL` (mostrar si NO fue dismissido NI completado)
- **AND** si `isVisible` es `false`, el hint no se renderiza

#### Scenario: No marcar seen apenas renderiza

- **WHEN** un componente renderiza un InlineGuide
- **THEN** NO hace INSERT/UPDATE automático a `seen_at`
- **AND** el componente llama a `mark('seen')` SOLO cuando el user scrollea el hint o interactúa (visible realmente)
- **NOTE**: Para Change 1 (hints inline simples), `mark('seen')` puede ocurrir al mount si está visible en viewport. Decisión de UX en implementación.

### Requirement: RLS en user_guidance_events

El sistema SHALL habilitar Row Level Security en `user_guidance_events` para que cada usuario solo pueda SELECT/INSERT/UPDATE registros donde `user_id = auth.uid()`.

#### Scenario: Usuario no puede ver guidance events de otro usuario

- **WHEN** user_A intenta SELECT de `user_guidance_events` WHERE user_id = user_B.id
- **THEN** la query retorna 0 filas (RLS bloquea)

#### Scenario: Usuario puede insertar/actualizar sus propios guidance events

- **WHEN** user_A ejecuta INSERT/UPDATE en `user_guidance_events` con `user_id = auth.uid()`
- **THEN** la query sucede normalmente
- **AND** si intenta con `user_id != auth.uid()`, RLS bloquea

### Requirement: Componente InlineGuide para hints debajo de campos (inline del primer movimiento)

El sistema SHALL exponer un componente web `<InlineGuide>` que renderiza un hint pequeño debajo de un campo de formulario. El hint debe ser dismissible con una pequeña X y no debe ocupar más espacio que una línea de texto (12-14px, gris).

Solo se usa en primer movimiento (3 campos: Tipo, Cuenta, Categoría).

```tsx
<InlineGuide
  guidanceId="first_movement.type"
  onDismiss={() => mark('first_movement.type', 'dismissed')}
>
  Gasto resta, ingreso suma. Simple, pero poderoso.
</InlineGuide>
```

#### Scenario: Renderizar InlineGuide en primer movimiento

- **WHEN** un usuario abre el formulario de movimiento por primera vez (`onboarding_completed_at < 7 days`)
- **THEN** se renderiza `<InlineGuide>` en Tipo, Cuenta y Categoría
- **AND** cada hint muestra texto gris 12px bajo el campo
- **AND** hay un botón pequeño (X) para dismiss

#### Scenario: Hacer clic en X dismisses hint

- **WHEN** usuario hace clic en la X del hint
- **THEN** se ejecuta `mark('first_movement.type', 'dismissed')`
- **AND** se actualiza `dismissed_at` en la tabla
- **AND** el hint desaparece de la pantalla inmediatamente

#### Scenario: No renderizar si fue dismissido o completado

- **WHEN** un usuario dismissió un hint en una sesión anterior (o completó el flujo)
- **THEN** `useGuidance('first_movement.type')` retorna `{ isVisible: false }`
- **AND** el hint NO se renderiza en la próxima sesión

### Requirement: Componente GuideCard para sugerencias contextuales

El sistema SHALL exponer un componente web `<GuideCard>` que renderiza una sugerencia educativa (ej: "Creá tus cuentas reales"). El card debe tener dos CTAs: acción principal y "No ahora".

```tsx
<GuideCard
  guidanceId="accounts.discovery"
  title="¿Dónde está tu plata?"
  description="Si además de CUÁNTA plata tenés, querés saber DÓNDE está..."
  primaryCta={{ label: "+ Crear cuenta", onClick: () => navigate('/accounts/new') }}
  secondaryCta={{ label: "No ahora", onClick: () => mark('accounts.discovery', 'dismissed') }}
/>
```

(Nota: `guidance_id` usa catálogo: `first_movement.*`, `accounts.*`, `cards.*`, `shared.*`, etc.)

#### Scenario: Renderizar GuideCard

- **WHEN** una página renderiza `<GuideCard guidanceId="X">`
- **THEN** se muestra una card con background subtil, título, descripción, y dos CTAs
- **AND** hacer clic en primary CTA ejecuta el callback + marca guidance como `'completed'`
- **AND** hacer clic en secondary ("No ahora") marca guidance como `'dismissed'`

#### Scenario: No mostrar si ya fue completado

- **WHEN** un usuario hizo clic en el CTA principal de un GuideCard
- **THEN** la próxima vez que visita esa página, el card NO aparece (porque `status='completed'`)

### Requirement: Hook `useGuidance(guidanceId)` para consulta y marcaje

El sistema SHALL exponer un hook personalizado `useGuidance(guidanceId)` que:
- Consulta el estado actual del guidance (`status`, `first_seen_at`, etc.)
- Retorna helper function `mark(status)` para actualizar el estado

```tsx
const { status, mark, isVisible } = useGuidance('first_movement_type')

// mark('dismissed') → UPDATE status='dismissed'
// mark('completed') → UPDATE status='completed'
// isVisible → booleano que es false si status='dismissed' o 'completed'
```

#### Scenario: Usar useGuidance para renderizado condicional

- **WHEN** un componente usa `const { isVisible } = useGuidance('X')`
- **THEN** `isVisible` es `true` si guidance es `null` o `'seen'`
- **AND** `isVisible` es `false` si guidance es `'dismissed'` o `'completed'`
- **AND** componente condicionalmente renderiza el hint basado en `isVisible`

### Requirement: Post-save "impacto" para primer movimiento (OPCIONAL en Change 1)

El sistema MAY mostrar un breve mensaje post-save explicando el impacto del movimiento SOLO si se puede enganchar sin refactoring mayor al flujo de mutaciones. Si ensucia la arquitectura, MUST quedar fuera de Change 1.

Mensaje de referencia (si se implementa):
"Listo. Este movimiento cambió tu disponible y va a aparecer en tu resumen del mes."

#### Scenario: Si es fácil enganchar: mostrar post-save

- **WHEN** usuario guarda su primer movimiento exitosamente Y no requiere cambios significativos a mutations
- **THEN** aparece un popover/toast no bloqueante con el mensaje de impacto
- **AND** se puede cerrar automáticamente o manualmente

#### Scenario: Si es complejo: DEJAR FUERA en Change 1

- **WHEN** enganchar post-save requiere refactoring mayor de flujos de mutation
- **THEN** esta feature se OMITE de Change 1 (documentar para Change 2)
- **AND** los hints inline en los 3 campos son suficiente educación por ahora

### Requirement: Tour guiado del primer movimiento

El primer movimiento DEBE (MUST) educarse mediante un tour guiado tipo spotlight,
no con hints de texto pasivos.

#### Scenario: Arranque automático para usuario sin movimientos

- **GIVEN** un usuario sin ningún movimiento registrado
- **AND** el tour `first_movement.tour` no fue completado ni omitido
- **WHEN** abre el drawer de nuevo movimiento con el tab en Gasto o Ingreso
- **THEN** el tour arranca automáticamente en el paso 1 (Monto)
- **AND** el resto del formulario se ve atenuado y solo el campo del paso actual queda iluminado

#### Scenario: Recorrido de los pasos

- **GIVEN** el tour está activo
- **WHEN** el usuario toca "Siguiente"
- **THEN** el spotlight avanza al próximo campo en el orden Monto → Cuenta → Categoría → Descripción → Guardar
- **AND** el globo muestra el progreso y el copy de ese paso (qué es y para qué sirve)

#### Scenario: Cierre por finalización

- **GIVEN** el usuario está en el paso de cierre (Guardar)
- **WHEN** toca el botón de finalizar
- **THEN** el tour se cierra
- **AND** se marca `completed_at` para `first_movement.tour`
- **AND** no vuelve a aparecer en próximas aperturas del drawer

#### Scenario: Omitir el tour

- **GIVEN** el tour está activo en cualquier paso
- **WHEN** el usuario toca "Omitir guía"
- **THEN** el tour se cierra
- **AND** se marca `dismissed_at` para `first_movement.tour`
- **AND** no vuelve a aparecer

#### Scenario: Usuario con movimientos no ve el tour

- **GIVEN** un usuario que ya tiene al menos un movimiento
- **WHEN** abre el drawer de nuevo movimiento
- **THEN** el tour no aparece

#### Scenario: El tour no aplica a tabs sin esos campos

- **GIVEN** el tour podría aplicar
- **WHEN** el tab activo es Transferencia, Ajuste o Cambio
- **THEN** el tour no se muestra (esos flujos no comparten los campos guiados)

### Requirement: Primitivo CoachmarkTour reutilizable

DEBE (MUST) existir un componente `CoachmarkTour` genérico, sin dependencias
externas, que reciba una lista de pasos (cada uno con un target, título y
descripción) y un contenedor donde resolver los targets.

#### Scenario: Spotlight sobre el target

- **WHEN** un paso está activo
- **THEN** el componente mide el target y dibuja un overlay oscuro con un recorte iluminado sobre ese elemento
- **AND** posiciona un globo con título, descripción, progreso y acciones cerca del target

#### Scenario: Re-medición ante scroll/resize

- **GIVEN** el target está dentro de un contenedor scrolleable
- **WHEN** el contenido scrollea o la ventana cambia de tamaño
- **THEN** el spotlight y el globo se reubican sobre el target

