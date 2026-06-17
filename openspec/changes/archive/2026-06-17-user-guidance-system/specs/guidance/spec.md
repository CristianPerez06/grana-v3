# guidance Specification

## Purpose

Sistema base para mostrar y persistir hints contextuales que acompañan al usuario mientras actúa. El primer caso real: hints en el primer movimiento (web).

Guidance IDs forman un catálogo conocido (enum), no strings libres. Esto evita IDs garbage imposibles de limpiar después.

## Guidance ID Catalog

```
first_movement.type       // Hint en campo "Tipo" del primer movimiento
first_movement.account    // Hint en campo "Cuenta" del primer movimiento
first_movement.category   // Hint en campo "Categoría" del primer movimiento
first_movement.saved      // Post-save validation (opcional, si se engancha fácil)
```

(Changes 2-3 agregarán IDs para cuentas, tarjetas, shared, etc.)

## ADDED Requirements

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

### Requirement: Primer movimiento web con InlineGuides (NO invasivo: solo 3 campos)

El sistema SHALL integrar InlineGuides SOLO en 3 campos clave del primer movimiento real del usuario: Tipo, Cuenta, Categoría. Los campos Monto, Fecha, y otros NO tienen hints en Change 1 (evita saturation).

**Trigger:** Usuario sin movimientos previos (detectado via `hasAnyTransaction` o equivalente query). Una vez el usuario completa/dismisse los hints, no reaparecen.

Copy de referencia (canon español):
- **Tipo**: "Gasto resta, ingreso suma. Simple, pero poderoso."
- **Cuenta**: "Esto responde: ¿de dónde salió o entró la plata?"
- **Categoría**: "Después usamos esto para mostrar en qué se te fue el mes."

#### Scenario: Usuario sin movimientos previos ve exactamente 3 hints

- **WHEN** un usuario abre el formulario de movimiento por PRIMERA VEZ (no tiene movimientos previos: `hasAnyTransaction === false`)
- **THEN** el formulario renderiza InlineGuides en EXACTAMENTE: Tipo, Cuenta, Categoría
- **AND** Monto, Fecha, y otros campos NO tienen hints
- **AND** cada hint es dismissible (pequeña X)

#### Scenario: Usuario con movimientos previos no ve hints

- **WHEN** un usuario que ya tiene movimientos registrados abre el formulario
- **THEN** NO se muestran InlineGuides (porque ya pasó el "primer movimiento")
- **AND** el formulario renderiza normalmente

#### Scenario: Hints no reaparecen tras dismiss/complete

- **WHEN** usuario dismisse un hint O completa el flujo del primer movimiento
- **THEN** los hints se marcan en DB (`dismissed_at` o `completed_at`)
- **AND** aunque el usuario borre TODOS sus movimientos después, los hints no vuelven (respeta la intención del usuario)

#### Scenario: Hints desaparecen si user los dismisse

- **WHEN** usuario hace clic en X para dismissir un hint
- **THEN** `dismissed_at = now()` en `user_guidance_events` para ese `guidance_id`
- **AND** el hint desaparece inmediatamente
- **AND** no reaparece en futuras sesiones (porque `dismissed_at IS NOT NULL`)

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
