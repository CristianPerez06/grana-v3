## Context

Ver `proposal.md — Why` para la motivación. Lo que hace falta saber para entender el enfoque:

**Inventario real de superficies con inputs** (relevado sobre el código, no estimado):

| Familia | Cantidad | Estado hoy |
|---|---|---|
| Pantallas pusheadas con formulario | 13 | `ScrollView` sin compensación |
| Pantalla root de tab con formulario inline (`home/index` → `SetupForm`) | 1 | `ScrollView` sin compensación **y sin** `keyboardShouldPersistTaps` |
| Overlays con inputs (3 `Drawer` de categorías, `RecurrenceEditForm` en `Drawer`, `MovementFiltersSheet`) | 5 | `ScrollView` dentro de `Modal`, sin compensación |
| Con `KeyboardAvoidingView` ya presente | 4 | `AuthShell` (ios `padding` / android `height`); `initial-balance`, `InstitutionPickerModal`, `BankSelector` (**ios only**, Android recibe `undefined`) |

Las 13 pantallas pusheadas son **estructuralmente idénticas**: `<View className="flex-1 bg-page"> + <PageHeader …/> + <ScrollView contentContainerClassName="px-6 py-6[ pb-28]" keyboardShouldPersistTaps="handled">`. Esa repetición es lo que hace viable arreglarlo en un solo lugar.

**Restricciones del entorno que condicionan la solución:**

- `app.json` declara `edgeToEdgeEnabled: true` y **no** fija `softwareKeyboardLayoutMode`. Bajo edge-to-edge el `KeyboardAvoidingView` de RN es poco confiable en Android — es la razón por la que 3 de las 4 superficies que hoy lo usan lo desactivan ahí (`behavior={undefined}`).
- El `TabBar` es un `tabBar` custom del navigator `Tabs`: vive **fuera** del contenedor de pantalla y no reacciona al teclado. Cualquier compensación basada en medir el frame de la pantalla tiene que lidiar con eso, y el resultado difiere entre rutas chromeless (sin tab bar) y rutas con tab bar.
- El proyecto ya corre con `expo start --dev-client` y buildea con EAS (`build:ios`, `build:android`, más variantes `--local`). No hay dependencia de Expo Go que preservar.
- `apps/mobile` **no tiene suite de tests**. `typecheck` y `lint` son la única verificación automatizable; el resto es validación manual en dispositivo.

## Goals / Non-Goals

**Goals:**

- Una sola implementación de compensación de teclado para las 23 superficies con inputs (19 sin cubrir + 4 que hoy tienen su propia variante), sin dos mecanismos conviviendo.
- Paridad iOS / Android real, incluyendo Android edge-to-edge.
- Que el campo enfocado se **scrollee a la vista**, no solo que el contenedor se desplace.
- Que una pantalla de formulario nueva herede el comportamiento sin escribir una línea de teclado.
- Reducir el boilerplate de chrome de las 13 pantallas pusheadas de ~12 líneas a ~4.

**Non-Goals:**

- Migrar `apps/web` (no tiene el problema).
- Rediseñar los formularios, su validación o su semántica contable. Este change es chrome puro.
- Unificar `Drawer` / `BottomSheet` / `Modal` en un solo primitivo de overlay: se toca su contenido, no su arquitectura.
- Introducir tests automatizados de UI en mobile. Queda como deuda conocida fuera de este change.
- Sacar `keyboardShouldPersistTaps` a un default global: se mantiene explícito por superficie, como está hoy.

## Decisions

### 1. `react-native-keyboard-controller` en vez del `KeyboardAvoidingView` de RN

**Elegido**: `react-native-keyboard-controller` (v1.22.x). Peer deps satisfechas — pide `react-native-reanimated >= 3.0.0` y el proyecto tiene `4.1.7`. Autolinking, sin config plugin.

**Por qué**: resuelve las tres cosas que el primitivo de RN no resuelve, y que son exactamente las tres que rompen hoy:

1. Android edge-to-edge — es el escenario que la librería documenta como soportado de primera clase, y es el que hizo que las 3 superficies existentes desactivaran Android.
2. Scroll del campo enfocado a la vista (`KeyboardAwareScrollView`), que es lo que necesita `MovementForm` (~950 líneas, monto a media altura, submit al final).
3. Animación en sincronía con el teclado en ambas plataformas, en vez del salto discreto del `KeyboardAvoidingView`.

**Alternativa considerada — quedarse con `KeyboardAvoidingView` de RN, envuelto en el mismo shell.** Se descartó pero **no es una mala opción**: da el mismo punto único de fix y cubre las mismas 19 superficies, con cero dependencias nativas. Lo que no da es el scroll al campo enfocado ni Android confiable bajo edge-to-edge, que son las dos razones por las que el problema existe hoy. Además, el `keyboardVerticalOffset` correcto depende de si la ruta tiene tab bar o no (ver Contexto), lo cual obliga a introducir ramas por ruta dentro del shell — justo la complejidad que el shell pretende eliminar. Queda documentada como **fallback**: si la librería no se sostiene en dispositivo, el shell se reimplementa por dentro sin tocar ninguno de los ~25 call sites.

**Alternativa considerada — `react-native-keyboard-aware-scroll-view`.** Descartada: sin mantenimiento activo, sin soporte de new architecture (el proyecto tiene `newArchEnabled: true`).

### 1b. El scroller se registra en NativeWind antes de usarlo

*(Decisión tomada durante la implementación — no estaba en el diseño original.)*

NativeWind no procesa `className` en cualquier componente: registra una lista fija (`react-native-css-interop/src/runtime/components.ts`). `ScrollView` está; `KeyboardAwareScrollView` no. Sin registrarlo, `className` y `contentContainerClassName` le llegan como strings pelados y se descartan en silencio: **las 13 pantallas migradas perderían todo su padding** y quedarían pegadas al borde de la pantalla.

TypeScript **no** detecta esto — NativeWind aumenta `ScrollViewProps` globalmente, así que ambas props tipan en cualquier componente que las extienda, esté registrado o no. La falla es solo de runtime y visual.

Por eso el scroller se exporta desde un módulo único (`components/layout/keyboard-aware-scroll-view.ts`) que hace el `cssInterop` una vez. **Nunca se importa `KeyboardAwareScrollView` directo de la librería**; siempre desde ese módulo.

### 2. El shell `FormScreen` vive en `components/layout/`, no en `components/ui/`

`AGENTS.md` — Component layering — exige que los primitivos de `components/ui/` tengan gemelo web, contract compartido en `@grana/ui-contracts` y story de Storybook. Un contenedor que esquiva el teclado **no tiene equivalente en web**: forzar un contract compartido inventaría una abstracción falsa. `components/layout/` es la carpeta de shells de app / route-group, donde ya vive `AuthShell` por exactamente el mismo motivo.

`FormScreen` **compone** `PageHeader` y le reenvía `PageHeaderProps` tal cual, así que el estilo canónico de título sigue viviendo en un solo lugar y las reglas de la capability `page-header` se siguen cumpliendo a través del shell (ver el delta de `page-header`).

API:

```tsx
type Props = PageHeaderProps & {
  onBackPress?: () => void
  /** Overrides el ritmo por defecto del content container. */
  contentClassName?: string
  children: ReactNode
}
```

`contentClassName` existe porque las 13 pantallas no comparten exactamente el mismo padding: la mayoría usa `px-6 py-6`, seis usan `px-6 py-6 pb-28`, `settle` usa `px-6 pt-6 pb-16`, `currency` agrega `gap-6`. El default es `px-6 py-6 pb-28` y cada pantalla que difiera lo pasa explícito. **No se normalizan los paddings en este change**: cambiar el ritmo vertical de 13 pantallas es un cambio visual que merece su propia decisión, y mezclarlo acá haría imposible atribuir una regresión visual a una causa.

### 3. `FormSheetBody` separado para los overlays

Los `Modal` de React Native montan una ventana nativa propia. El contexto de teclado se ancla a la ventana, así que el contenido del overlay necesita su **propio provider anidado** dentro del modal — el del root layout no lo alcanza. En vez de repetir ese detalle en las 5 superficies (y en cada sheet futuro), se encapsula en `FormSheetBody`, que envuelve provider + scroller keyboard-aware.

`Drawer` y `BottomSheet` **no** se modifican: siguen siendo primitivos de presentación tontos. Es el *contenido* del overlay el que se envuelve en `FormSheetBody`, y solo en los 5 casos que tienen inputs. Un `SelectSheet` sin campo de búsqueda no paga nada.

### 3b. `FormSheetKeyboardView` para overlays que ya tienen su propia lista

*(Decisión tomada durante la implementación — no estaba en el diseño original.)*

Los dos pickers con búsqueda (`InstitutionPickerModal`, `BankSelector`) no llevan su contenido en un `ScrollView`: llevan un `FlatList` con `maxHeight` propio. Meterlos en `FormSheetBody` anidaría una `VirtualizedList` dentro de un `ScrollView` — RN emite warning, la virtualización se rompe y la lista renderiza todas sus filas.

Se agrega entonces un **hermano** de `FormSheetBody`: `FormSheetKeyboardView`, que monta el `KeyboardProvider` anidado (misma razón: RN `Modal` = otra ventana) y desplaza a sus hijos con el `KeyboardAvoidingView` **de la librería** — no el de React Native — sin proveer scroller propio. La lista sigue scrolleando sola.

La regla para elegir entre los dos es mecánica, no estética:

- El overlay trae contenido de formulario y necesita scroll → `FormSheetBody`.
- El overlay ya administra su propia región scrolleable (`FlatList`) → `FormSheetKeyboardView`.

### 4. `KeyboardToolbar` global, montado una sola vez

`MoneyAmountInput` fuerza `keyboardType="decimal-pad"`. En iOS ese teclado **no tiene tecla de retorno**, así que hoy el único modo de cerrarlo es tocar fondo vacío del scroll — no descubrible, y en un formulario denso puede no haber fondo vacío visible. La barra accesoria se monta una vez junto al provider del root y aplica a toda la app; no requiere tocar ningún campo.

### 4b. `bottomOffset` DEBE incluir la altura del toolbar

*(Corrección hecha durante la implementación, tras la primera validación en dispositivo.)*

`KeyboardAwareScrollView` posiciona el campo enfocado a `bottomOffset` por encima del borde superior **del teclado**, y **no sabe nada del `KeyboardToolbar`** — no hay una sola referencia al toolbar en su código. El toolbar flota en esos 42px (`KEYBOARD_TOOLBAR_HEIGHT`, constante interna no exportada).

Con `bottomOffset={24}` el toolbar tapaba los 18px inferiores de un input de 44px (`h-11`): el campo se leía como "tapado a la mitad por el teclado", que fue exactamente el síntoma reportado. La compensación *parcial* es la firma de este bug — si el scroller no funcionara en absoluto, el formulario no se movería nada.

`bottomOffset` pasa entonces a `42 + 24 = 66`, definido una sola vez como `KEYBOARD_BOTTOM_OFFSET` en `components/layout/keyboard-aware-scroll-view.ts` y consumido por los cinco call sites. No se hardcodea por pantalla: si el toolbar cambia de alto o se saca, hay un único lugar que tocar.

### 5. El `TabBar` se oculta con el teclado leyendo el estado del teclado, no midiendo alturas

`TabBar` ya tiene un early return (`if (chromeless) return null`). Se agrega una segunda condición leyendo el estado de visibilidad del teclado desde el provider. Es un cambio de 3 líneas en un componente que ya sabe ocultarse, y evita tener que compensar el alto del tab bar dentro del shell.

**Alternativa considerada — `tabBarHideOnKeyboard` del navigator.** No aplica: es una opción de `@react-navigation/bottom-tabs` que solo funciona en Android y solo sobre su tab bar propio, no sobre un `tabBar` custom.

### 6. Las 4 superficies que ya tienen `KeyboardAvoidingView` se migran también

Podrían dejarse como están (funcionan en iOS). Se migran igual por dos razones: **Android hoy no está cubierto en 3 de las 4**, que es la mitad del problema que este change viene a resolver; y dejar dos mecanismos conviviendo garantiza que el próximo formulario copie el equivocado. `AuthShell` mantiene su layout centrado y su `flex-grow justify-center` — solo cambia el mecanismo de teclado por dentro.

## Risks / Trade-offs

- **El provider anidado dentro de los `Modal` de RN no se comporta como se espera en alguna de las dos plataformas** → Es el único riesgo técnico real y se ataca primero: se valida en dispositivo iOS + Android sobre **una** superficie de overlay (el `Drawer` de alta de categoría) **antes** de migrar las otras cuatro. Si no se sostiene, las 5 superficies de overlay se quedan con el `KeyboardAvoidingView` actual y las 13 pantallas pusheadas + el root layout avanzan igual — el valor principal del change no depende de esto.
- **Dependencia nativa nueva → rebuild obligatorio de dev client y de los perfiles EAS** → Se asume conscientemente: el proyecto ya usa dev client, no Expo Go. La tarea de rebuild está explícita en `tasks.md` antes de cualquier validación en dispositivo, para que nadie valide contra un binario viejo y concluya que la librería no funciona.
- **~25 archivos tocados sin red de tests** → La migración es mecánica (borrar chrome repetido, cambiar el import), y `typecheck` atrapa cualquier prop mal reenviada. El riesgo residual es visual, y se acota con dos decisiones: no normalizar paddings (§2) y validar superficie por superficie con un checklist explícito en `tasks.md`.
- **`FormScreen` acopla header y cuerpo scrolleable** → Una pantalla que necesite un cuerpo no scrolleable, un header distinto o un layout de dos zonas no puede usar el shell. Es aceptable: hoy ninguna de las 13 lo necesita, y el shell no es obligatorio — una pantalla puede seguir componiendo el árbol a mano (la capability `page-header` sigue admitiendo ambas formas). El caso mixto real es `home/settle`, que tiene una rama de éxito con su propio `ScrollView`: se migran ambas ramas al shell.
- **El shell agrega un nivel de indirección entre la pantalla y `PageHeader`** → Mitigado por el contract: `FormScreen` extiende `PageHeaderProps` en vez de redefinir props, así que cualquier cambio futuro en el contract del header rompe el typecheck del shell en vez de derivar silenciosamente.

## Migration Plan

Cuatro fases, ordenadas para que el riesgo se descubra temprano y barato:

1. **Base + prueba de fuego** — instalar la dependencia, montar el provider en el root layout, rebuild de dev client, y crear `FormScreen`. Migrar **una sola** pantalla pusheada (`settings/categories/new`, la más chica) y **un solo** overlay (`Drawer` de alta de categoría, que valida el provider anidado). Validar ambas en iOS y Android. Este es el punto de decisión: si el provider anidado falla, la fase 3 se recorta al fallback sin haber tocado 25 archivos.
2. **Pantallas pusheadas** — migrar las 12 restantes + `home/index`, en tandas por feature (categorías, cuentas, tarjetas, movimientos/recurrencias, hogar) para que cada tanda sea revisable de a una.
3. **Overlays + chrome** — las 4 superficies de overlay restantes, el `TabBar` con teclado y el `KeyboardToolbar`.
4. **Unificación** — migrar las 4 superficies que hoy usan `KeyboardAvoidingView` y verificar que no queda ningún `KeyboardAvoidingView` de `react-native` importado en `apps/mobile`.

**Rollback**: el change es aditivo hasta la fase 2. Revertir es `git revert` del rango + rebuild de dev client; no hay migración de datos, estado persistido ni contrato de API involucrado. Un rollback parcial también es viable: `FormScreen` puede reimplementarse por dentro con el `KeyboardAvoidingView` de RN sin tocar ningún call site (ver §1).
