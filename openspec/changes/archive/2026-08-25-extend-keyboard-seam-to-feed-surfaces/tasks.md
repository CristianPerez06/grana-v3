## 1. Feed de movimientos

- [x] 1.1 En `apps/mobile/app/(app)/transactions/index.tsx`, importar `KeyboardAwareScrollView` y `KEYBOARD_BOTTOM_OFFSET` desde `../../../components/layout/keyboard-aware-scroll-view` y sacar `ScrollView` del import de `react-native`
- [x] 1.2 Reemplazar el `<ScrollView>` por `<KeyboardAwareScrollView>` conservando `contentContainerClassName="gap-4 px-6 py-6 pb-28"`, y agregar `bottomOffset={KEYBOARD_BOTTOM_OFFSET}` y `keyboardShouldPersistTaps="handled"`

## 2. Detalle de cuenta

- [x] 2.1 En `apps/mobile/app/(app)/accounts/[id]/index.tsx`, importar `KeyboardAwareScrollView` y `KEYBOARD_BOTTOM_OFFSET` desde `../../../../components/layout/keyboard-aware-scroll-view` y sacar `ScrollView` del import de `react-native` (dejando `RefreshControl`)
- [x] 2.2 Reemplazar el `<ScrollView>` por `<KeyboardAwareScrollView>` conservando `contentContainerClassName="gap-5 px-6 py-6"` y la prop `refreshControl`, y agregar `bottomOffset={KEYBOARD_BOTTOM_OFFSET}` y `keyboardShouldPersistTaps="handled"`

## 3. Spec

- [x] 3.1 Aplicar el delta de `mobile-app-shell` sobre `openspec/specs/mobile-app-shell/spec.md` (se hace al archivar el change, no antes)

## 4. Verificación mecánica

- [x] 4.1 `pnpm typecheck` sin errores
- [x] 4.2 `pnpm lint` sin errores
- [x] 4.3 Confirmar por lectura que ninguno de los dos archivos importa de `react-native-keyboard-controller` directo ni monta un `KeyboardAvoidingView`

## 5. Verificación en dispositivo (development build, no Expo Go — la corre el usuario)

- [x] 5.1 Movimientos → en un reintegro pendiente, tocar `Confirmar` una vez para desplegar los campos (es un botón de dos toques: el primero expande, el segundo commitea) → enfocar el monto real: el campo, su texto de error y el botón quedan por encima del teclado y del `KeyboardToolbar`
- [x] 5.2 Con el teclado abierto, poner el monto en `0` y tocar `Confirmar`: aparece el error de monto positivo al primer toque, sin que el tap se consuma cerrando el teclado. El `0` corta en la validación antes de escribir, así que el chequeo no commitea el reintegro
- [x] 5.3 Movimientos → cerrar el teclado: el tab bar vuelve sin hueco ni salto de layout, y el padding inferior del feed se ve igual que antes del cambio
- [x] 5.4 Detalle de cuenta → abrir el buscador inline: el campo queda visible con el teclado abierto, y la `X` de limpiar y los chips de filtro responden al primer toque
- [x] 5.5 Detalle de cuenta → pull-to-refresh sigue funcionando con el scroller nuevo
- [x] 5.6 Repetir 5.1 y 5.4 en Android edge-to-edge

## 6. Cierre

- [x] 6.1 Commit squasheado en la rama de trabajo, título en inglés `type(scope): subject`, sin body ni trailers
- [x] 6.2 Archivar el change con `openspec archive`, lo que vuelca el delta sobre `openspec/specs/mobile-app-shell/spec.md`
