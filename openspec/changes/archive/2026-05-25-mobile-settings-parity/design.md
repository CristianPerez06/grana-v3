## Context

`apps/web/app/(app)/settings/` agrupa tres secciones bajo un único `PageHeader title="Configuración"`:

1. **Visualización** — `ShowCentsToggle` que llama el server action `setShowCents(value)`, que escribe la cookie `show_cents` con `maxAge` de 1 año y dispara `revalidatePath('/', 'layout')` para que el layout re-renderee con la preferencia nueva. La preferencia se distribuye a Client Components vía `PreferencesProvider` envolviendo el árbol en `apps/web/app/(app)/layout.tsx`.
2. **Idioma** — `LanguageSwitcher` que llama `setLocaleAction(locale)`, que escribe la cookie `NEXT_LOCALE` y revalida el layout. Activo y persistente vía `next-intl`.
3. **Categorías** — link a `/settings/categories`, que es un CRUD completo (lista, alta, edición, archivar/eliminar, subcategorías por categoría) que llama server actions en `apps/web/app/_actions/categories.ts`. Estos validan con schemas de `@grana/validation` y delegan a Supabase server client (con RLS).

En mobile:

- El `AppMenu` ya tiene un ítem "Configuración" cuyo `onPress` es `onClose` (no navega). El spec actual de `mobile-app-shell` lo documenta explícitamente como follow-up para cuando la pantalla exista en mobile.
- `apps/mobile/lib/preferences.ts` ya tiene `getShowCents` / `setShowCents` contra `expo-secure-store`, y `PreferencesContext` lee el valor en mount — pero no hay setter expuesto, así que el cambio no es reactivo dentro de la sesión.
- `apps/mobile/lib/i18n.ts` `t()` está hardcodeado a `esMessages`. No existe `LocaleProvider` ni mecanismo para cambiar de idioma sin recompilar.
- No existen pantallas mobile para categorías. La tabla `categories` (y `subcategories`) ya tiene RLS que enforce las reglas; no hay nada del lado backend que cambiar.

El usuario eligió **paridad completa con web** y entry desde **AppMenu → Settings**. El diseño debe entregar los tres bloques en mobile, respetando que mobile es un cliente Supabase puro (sin server actions) y conviven dos plataformas con preferencias UI-only divergentes (esperado, documentado en el TODO de `preferences.ts`).

## Goals / Non-Goals

**Goals:**

- Pantalla mobile `/settings` con paridad visual y funcional respecto a `apps/web/app/(app)/settings/page.tsx`.
- Toggle de "Mostrar centavos" mobile cableado al `PreferencesContext` con update reactivo en sesión (no solo en próximo arranque).
- Selector de idioma mobile con persistencia local en `expo-secure-store` y re-render reactivo de toda la app cuando cambia.
- CRUD de categorías y subcategorías propias en mobile (alta, edición, archivar, eliminar; subcategorías por categoría), respetando las invariantes de DB (RLS, `canonical_name` inmutable, no editar sistema).
- `AppMenu` → "Configuración" navega a `/(app)/settings` y cierra el sheet.
- Nuevos prop contracts en `@grana/ui-contracts` para los componentes compartidos (toggle, switcher, section header).

**Non-Goals:**

- Migrar `show_cents` a una columna en `users` (sigue el TODO existente en `apps/mobile/lib/preferences.ts`). Web y mobile mantienen preferencias independientes hasta entonces.
- Sincronizar la cookie `NEXT_LOCALE` web con la SecureStore de mobile. Cada plataforma persiste localmente; la sincronización entre dispositivos no es scope.
- Cambios de DB o de RLS sobre `categories` / `subcategories`. Las reglas ya están y aplican igual al cliente mobile.
- Cambios visuales o de copy en la pantalla web `/settings` más allá de adoptar los prop contracts compartidos donde aplique.
- Adopción del módulo `recurring-movements` u otros módulos sin paridad mobile. Acá solo se cubre lo que `/settings` (web) ya expone.
- Migración a `react-i18next` o reemplazo del helper `t()` actual por una librería completa. Mantenemos el helper de `apps/mobile/lib/i18n.ts`, solo lo hacemos locale-aware.

## Decisions

### 1. Persistencia de locale en mobile: `expo-secure-store`, no AsyncStorage

`expo-secure-store` ya está instalado y usado para `show_cents` y la sesión Supabase. Sumar otra librería de almacenamiento (`AsyncStorage`) solo para guardar el locale es overhead sin justificación. Clave: `locale`, valor: `'es' | 'en'`. Default: `'es'`.

**Alternativa descartada:** `AsyncStorage`. Más liviano y "más estándar" para preferencias UI, pero arrastra dependencia nueva. SecureStore funciona bien para strings cortos sin penalización notable.

### 2. `LocaleProvider` en lugar de hacer `t()` globalmente reactivo a un store

Patrón espejo al `PreferencesProvider` ya existente: un `LocaleProvider` en el root layout lee el locale desde SecureStore en mount, expone `useLocale()` y `setLocale()` a través de Context, y mantiene el catálogo activo (`es` | `en`) memoizado en su estado.

`t()` se vuelve un hook `useT()` para uso dentro de componentes (lee del Context). Para uso fuera de componentes (helpers puros como formatters de error), se mantiene la función `t()` actual con un fallback a `es` — explícito y documentado. Los call sites que dependen de locale deben pasar a `useT()`.

**Alternativa descartada:** un store imperativo (`zustand`/módulo singleton) con suscripción. Para una app del tamaño actual, agregar una abstracción de estado global solo para esto es prematuro. Context es suficiente.

**Trade-off:** los componentes que hoy llaman `t()` directamente quedan con copy en español. Migrarlos a `useT()` es trabajo de seguimiento; este change los migra solo donde aparecen en las pantallas mobile de settings.

### 3. `setShowCents` reactivo expuesto desde `PreferencesProvider`

Hoy `PreferencesContext` expone solo el valor. Se cambia a exponer `{ showCents, setShowCents }` donde `setShowCents(value)` (a) escribe en SecureStore y (b) actualiza el state del provider. El toggle mobile lo consume directo — sin `revalidatePath` (concepto Next que no aplica a Expo), el re-render lo dispara React Context.

**Por qué no `useEffect` polling**: no escala y no cubre el caso "cambié el toggle, quiero ver el dashboard ya actualizado al volver". El setter centralizado y el provider único garantizan que cualquier consumer re-rendere.

### 4. CRUD de categorías mobile: cliente Supabase directo, validación compartida

No hay server actions en mobile. Las pantallas usan `supabase.from('categories')...` directo. La validación reusa los schemas Yup de `@grana/validation` (los mismos que web). Las reglas de negocio (RLS para bloquear edición de sistema, trigger de unicidad de `canonical_name`, no eliminar con transacciones asociadas en el futuro) viven en DB y aplican igual.

El cliente mobile mapea errores de Postgres a strings i18n (`23505` → "ya existe una categoría con ese nombre", error genérico → fallback).

**Por qué no extraer `categoriesService` a `packages/`**: las queries dependen del cliente Supabase de cada app (cookie-based en web, SecureStore-based en mobile). El patrón actual mantiene queries en `apps/<name>/lib/` y comparte solo lógica pura — sigue esa convención.

### 5. Navegación mobile de settings: stack anidado en `(app)/settings/`

Expo Router usa file-based routing. Estructura propuesta:

```
app/(app)/settings/
  _layout.tsx            // Stack screen
  index.tsx              // pantalla principal
  categories/
    _layout.tsx
    index.tsx            // lista
    new.tsx              // alta
    [id]/
      edit.tsx
      subcategories/
        index.tsx        // lista de subcats
        new.tsx          // alta de subcat
```

`_layout.tsx` en cada nivel usa `Stack` (no `Tabs`) — es navegación lineal entrar/salir. El `Stack` queda anidado dentro del `Tabs` global de `(app)/_layout.tsx`. La ruta `/(app)/settings` no aparece como tab visible (no se agrega a `<Tabs.Screen>` con label), se accede solo desde `AppMenu`. Hay que registrarla en el `Tabs` con `options={{ href: null }}` como ya se hace con `tarjetas` y `accounts`.

### 6. Contratos compartidos en `@grana/ui-contracts`

Agregar:

- `ShowCentsToggleProps = { value: boolean; onValueChange: (next: boolean) => void; disabled?: boolean; label: string; description?: string }`. El web actual no acepta props (lee desde server action); para adoptar el contrato, se refactoriza para recibir `value`/`onValueChange` y mover la llamada al server action al parent (página). Esto rompe nada visible al usuario y prepara el terreno para tests aislados.
- `LanguageSwitcherProps = { current: Locale; locales: readonly Locale[]; onSelect: (locale: Locale) => void; disabled?: boolean; renderLabel: (locale: Locale) => string; ariaLabel: string }`. Igual: web refactoriza para recibir current/locales/onSelect del parent.
- `SettingsSectionProps = { title: string; children: ReactNode; className?: string }` — tarjetón con header uppercase + contenedor estilo card. Compartido para que los tres bloques mantengan exactamente la misma estructura visual en ambas plataformas.

**Por qué subir el state al parent**: el contrato compartido no puede asumir un mecanismo de side-effect (server action vs SecureStore). El componente toggle es presentacional puro; el parent decide cómo persistir.

### 7. Tag `(mobile)` vs nuevas capabilities

Las features nuevas son extensión de las capabilities existentes (`settings`, `i18n`, `categories`, `mobile-app-shell`), no capabilities nuevas. Siguiendo la convención de proyecto (`project-conventions`), se agregan scenarios `(mobile)` a los requirements existentes — o se agrega un requirement nuevo dentro de la misma capability cuando la conducta mobile es distinta a la web (caso `i18n` mobile, que no tiene cookie ni middleware sino SecureStore + Context).

## Risks / Trade-offs

- **Divergencia `show_cents` web vs mobile** → ya documentado y aceptado en el TODO de `apps/mobile/lib/preferences.ts`. Mitigación: el TODO permanece; cuando se migre `show_cents` a columna en `users`, ambos clients leen del mismo source of truth.
- **Divergencia de locale web vs mobile** → mismo trade-off que `show_cents`. Mitigación: documentar en `apps/mobile/lib/locale.ts` con un TODO espejo apuntando al mismo follow-up de migración a `users.preferences`.
- **Refactor de web para adoptar los contratos compartidos** → tocamos `show-cents-toggle.tsx` y `language-switcher.tsx` web aunque el cambio sea funcional cero. Riesgo de regresión bajo (los componentes son chicos y tienen Storybook). Mitigación: el refactor mantiene los mismos llamados a `setShowCents` y `setLocaleAction` en el parent (la página); el componente solo cambia su contrato de props.
- **`t()` legacy queda mezclado con `useT()` nuevo** → el resto de mobile sigue importando `t()` global con fallback a `es`. Mitigación: documentar en `apps/mobile/lib/i18n.ts` que `t()` es para uso fuera de componentes y devuelve siempre `es`; los componentes deben usar `useT()`. Migración progresiva en changes siguientes.
- **Catálogo `en` incompleto para mobile** → `packages/i18n-messages/src/en.json` ya existe (lo usa web), pero las pantallas mobile actuales no se renderean nunca en inglés (siempre `es`). Cuando el switcher mobile permita pasar a `en`, las pantallas que llaman `t()` global (no migradas a `useT()`) van a mostrar el fallback `es`. Mitigación: aceptado como trade-off; el switcher mobile es funcional para las pantallas que usen `useT()` (las de settings creadas en este change). Las pantallas legacy se migran progresivamente.
- **Categorías sistema con i18n** → el catálogo de categorías de sistema ya tiene traducciones (`categories.*` keys). La lista mobile debe usar `useT()` para resolverlas correctamente cuando el locale activo sea `en`. Mitigación: la lista mobile va por `useT()` desde el día uno (no `t()` global).
- **Volumen del change** → cubre tres bloques + i18n reactiva + CRUD categorías. Es grande pero atómico (todo "settings" en una pantalla). Alternativa de partir en N changes fue evaluada: rompe la unidad conceptual de "mobile settings parity" y obliga a checkpoints de pantalla incompleta. Aceptamos el tamaño con tasks granulares.
