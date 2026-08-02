## Why

En `apps/mobile` hay **19 superficies con campos de texto que no reaccionan al teclado**: el teclado nativo se abre encima del formulario y tapa el campo enfocado, el error de validación y el botón de submit. El usuario tiene que cerrar el teclado a mano, scrollear a ciegas y volver a abrirlo — en formularios largos como el de alta de movimiento (`MovementForm`, ~950 líneas, con el campo de monto a media altura y el submit al final) directamente no se puede completar el alta sin pelear con la pantalla.

Solo 4 superficies tienen `KeyboardAvoidingView` hoy, y 3 de ellas lo pasan como `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — es decir, **Android no tiene compensación de teclado en ninguna pantalla salvo las de auth**. Eso no es un descuido puntual: `app.json` declara `edgeToEdgeEnabled: true`, y bajo edge-to-edge el `KeyboardAvoidingView` de React Native es justamente el menos confiable en Android, así que cada intento previo terminó desactivándolo ahí.

Además, aun donde el `KeyboardAvoidingView` existe, **no scrollea el campo enfocado a la vista**: solo desplaza o paddea el contenedor. Para los formularios largos de Grana (movimiento, tarjeta, recurrencia) eso no alcanza. El `pb-28` suelto en varias pantallas es una compensación a mano de ese mismo síntoma.

## What Changes

- **Se adopta `react-native-keyboard-controller`** como dependencia nativa de `apps/mobile`. Resuelve las tres cosas que el primitivo de RN no resuelve: soporta Android edge-to-edge, anima en sincronía con el teclado en ambas plataformas, y **scrollea el campo enfocado por encima del teclado**. Sus peer deps ya están satisfechas (Reanimated 4.1.7 ≥ 3.0.0). Requiere un rebuild nativo; el proyecto ya corre con `expo start --dev-client` + EAS, así que no hay regresión de Expo Go que preservar.
- **`<KeyboardProvider>` se monta en el root layout**, dentro de `SafeAreaProvider` y por fuera del resto del árbol.
- **Nuevo shell `FormScreen`** en `apps/mobile/components/layout/`. Reemplaza el triple `<View flex-1 bg-page> + <PageHeader> + <ScrollView>` que hoy repiten idénticamente 13 pantallas de formulario, y sustituye el `ScrollView` por el scroller keyboard-aware. Va en `components/layout/` y no en `components/ui/` porque la política Web ↔ Mobile exige que los primitivos de `ui/` tengan gemelo web + contract compartido en `@grana/ui-contracts`, y un contenedor que esquiva el teclado no tiene significado en web. `AuthShell` ya vive en esa misma carpeta por la misma razón.
- **Nuevo `FormSheetBody`** para las 5 superficies de overlay (`Drawer` / `BottomSheet` / `Modal`). Los modales de RN crean su propia ventana, así que el contenido del overlay necesita su propio `KeyboardProvider` anidado; `FormSheetBody` encapsula ese detalle en un solo lugar en vez de repetirlo en cada sheet.
- **`KeyboardToolbar` global** (barra accesoria con Listo / anterior / siguiente). `MoneyAmountInput` fuerza `keyboardType="decimal-pad"`, que en iOS **no tiene tecla de retorno**: hoy el único modo de cerrar el teclado en un campo de monto es tocar el fondo vacío del scroll. Es un bug de accesibilidad real, no un extra.
- **El `TabBar` se oculta mientras el teclado está visible.** El tab bar lo renderiza el navigator por fuera de la pantalla y hoy nunca reacciona al teclado, así que en las superficies que lo conservan (`home/index`, los `Drawer` de categorías) queda intercalado entre el contenido y el teclado.
- **Se migran las 19 superficies** al nuevo shell / body, y se corrigen de paso las 2 que además carecen de `keyboardShouldPersistTaps="handled"` (`home/settle`, `home/index`).
- **Las 4 superficies que hoy sí tienen `KeyboardAvoidingView`** (`AuthShell`, `onboarding/initial-balance`, `InstitutionPickerModal`, `BankSelector`) se unifican bajo el mismo mecanismo, para que no queden dos soluciones conviviendo y para que Android deje de ser un caso sin cubrir.
- **No alcanza**: `apps/web` (no tiene el problema), la semántica contable de ningún formulario, las queries/mutations, las migraciones, ni los contracts de `@grana/ui-contracts`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `mobile-app-shell`: hoy la capability fija el chrome transversal del shell (safe-area, StatusBar, providers del root layout) pero **no dice nada sobre el teclado**. Se agrega el requirement de que el shell garantice que ningún campo enfocado quede tapado por el teclado en ninguna superficie con input, el montaje de `KeyboardProvider` en el root layout como parte del orden de providers ya especificado, y el comportamiento del `TabBar` frente al teclado.
- `categories`: los tres requirements de CRUD de categorías/subcategorías en mobile fijan hoy que el alta y la edición ocurren en un **bottom-sheet** (`components/ui/Drawer`) "sin navegar a otra pantalla", con las pantallas `/new` y `/[id]/edit` conservadas solo como fallback de deep-link. En un teléfono ese drawer ocupa el 100% del ancho: deja de leerse como panel lateral y se comporta como pantalla completa, pero sin gesto de back, sin back físico que popee y con el cierre colgando de un único botón X — si ese botón no responde, el usuario queda encerrado en el formulario (reportado en dispositivo). Además arrastra un header blanco ad-hoc que no se parece a ningún otro formulario de la app. Los tres requirements pasan a pantalla pusheada con `FormScreen`. Web conserva el drawer; la divergencia queda documentada en los propios requirements.
- `page-header`: el requirement de estructura canónica de pantalla escribe literalmente el árbol `<View className="flex-1 bg-page"> + <PageHeader> + <ScrollView>` y exige que las pantallas rendericen `<PageHeader>` de forma directa. Con `FormScreen` las 13 pantallas de formulario pasan a renderizar el shell, que **compone** `PageHeader` internamente. Se modifica el requirement para admitir explícitamente la composición vía shell (manteniendo las dos invariantes que de verdad importan: el header sigue siendo sibling del scroller — nunca hijo del `contentContainer` — y la pantalla sigue sin declarar `SafeAreaView edges={['top']}` propia), de modo que la migración no quede como drift silencioso contra la spec.

## Impact

- **Dependencias**: `react-native-keyboard-controller` (nueva, nativa) en `apps/mobile/package.json`. Implica un rebuild de dev client y de los perfiles EAS. No requiere config plugin (autolinking).
- **Código nuevo**: `apps/mobile/components/layout/FormScreen.tsx`, `apps/mobile/components/layout/FormSheetBody.tsx`.
- **Código modificado**: `app/_layout.tsx` (provider + toolbar), `components/layout/TabBar.tsx` (ocultar con teclado), 13 pantallas de formulario bajo `app/(app)/**`, 5 superficies de overlay (`settings/categories/index`, `settings/categories/[id]/subcategories/index`, `components/categories/CategoryRow`, `app/(app)/transactions/recurring/[id]`, `components/accounts/MovementFiltersSheet`), y las 4 superficies que hoy usan `KeyboardAvoidingView` (`AuthShell`, `onboarding/initial-balance`, `InstitutionPickerModal`, `BankSelector`).
- **Sin cambios**: `apps/web`, `packages/**`, `supabase/**`.
- **Riesgo**: medio-bajo. Es chrome de presentación, sin lógica contable, pero toca el root layout y ~25 archivos, y suma una dependencia nativa. El riesgo concreto y acotado es el comportamiento del provider anidado dentro de los `Modal` de RN: se valida en dispositivo real (iOS + Android) antes de migrar las 5 superficies de overlay, y si no se sostiene, esas 5 se quedan con `KeyboardAvoidingView` sin bloquear las 13 pantallas pusheadas.
- **Verificación**: manual en dispositivo/simulador iOS y Android — no hay suite de tests de UI en `apps/mobile`, y `pnpm --filter mobile typecheck` + `lint` solo cubren la parte estática. El plan de validación por superficie vive en `tasks.md`.
