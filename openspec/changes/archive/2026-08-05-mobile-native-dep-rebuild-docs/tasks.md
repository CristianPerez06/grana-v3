## 1. README de mobile

- [x] 1.1 Requisitos: sacar Expo Go como opción y explicitar que hace falta un development build propio, con un aviso destacado de que Expo Go **no se usa nunca** en este proyecto (razón estructural: binario fijo con set cerrado de módulos nativos).
- [x] 1.2 Tabla de scripts: corregir `dev` (`expo start --dev-client`, nunca Expo Go), `ios` (`expo run:ios`, build nativo completo) y `android` (`expo run:android`).
- [x] 1.3 Nueva sección "Dependencias nativas": la regla (instalar ≠ linkear), el comando, y que aplica también al traer cambios de otra persona.
- [x] 1.4 Tabla síntoma → causa → fix para `doesn't seem to be linked`, `Failed to get the SHA-1` y `Unable to resolve module`.
- [x] 1.5 Aviso del layout `hoisted`: las deps viven en el `node_modules` de la raíz; que falten en `apps/mobile/node_modules/` es lo esperado y no amerita reinstalar.
- [x] 1.6 Corregir la referencia obsoleta a `node-linker=hoisted` en el `.npmrc` raíz → `pnpm-workspace.yaml`.

## 2. Spec

- [x] 2.1 Delta de `mobile-app-shell` con los tres requirements (Expo Go nunca / rebuild obligatorio / layout hoisted).
- [x] 2.2 `openspec validate --strict` en verde.

## 3. Cierre

- [x] 3.1 Archivar el change en la rama antes del merge (mover a `openspec/changes/archive/YYYY-MM-DD-…`, aplicar el delta a `openspec/specs/mobile-app-shell/spec.md`, sin dejar secciones de delta en el master spec).
- [x] 3.2 `pnpm openspec:check` en verde.
