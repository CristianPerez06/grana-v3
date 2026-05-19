# Próximas Fases — Grana Mobile

Tracker temporal de trabajo pendiente relacionado a la app mobile, builds y distribución. Cada ítem tiene:

- **Qué**: descripción concreta de la tarea.
- **Bloqueador**: lo que tiene que pasar antes de poder arrancarla.
- **Listo cuando**: definition of done.
- **Notas**: contexto adicional o links si aplica.

**Este archivo es temporal**. Cuando esté vacío (todos los ítems resueltos), borrar.

---

## EAS / Mobile

### Fase 5 — Credenciales iOS device + primer build para iPhone físico

- **Qué**: Activar builds de iOS para dispositivos reales (no solo simulator). Implica registrar las UDIDs de los iPhones del equipo, generar el Distribution Certificate + Provisioning Profile vía EAS, cambiar `ios.simulator: true` → `false` en `eas.json`, y validar instalación + smoke test en al menos un iPhone físico.
- **Bloqueador**: Apple Developer Program enrollment ($99/año, ~1-2 días de verificación por parte de Apple).
- **Listo cuando**:
  - Apple Dev account activa y linkeada con EAS (`eas credentials -p ios` la encuentra).
  - Al menos un device registrado con `eas device:create`.
  - Build de iOS instalada en un iPhone físico, app abre, login funciona contra Supabase.
  - `EAS_SETUP.md` actualizado con Fase 5 documentada (incluyendo el flujo de `eas device:create`).
- **Notas**: hasta entonces, iOS solo se valida en simulator via builds locales (`pnpm eas:ios:local`).

### Fase 8a — `eas submit` a stores

- **Qué**: Subir builds a TestFlight (iOS) y Play Console internal testing track (Android). Implica configurar `eas.json` con un bloque `submit`, generar credentials de App Store Connect (API key) y Play Console (service account JSON).
- **Bloqueador**:
  - **iOS**: Fase 5 completa + decisión de publicar.
  - **Android**: cuenta paga de Google Play Developer ($25 único) + decisión de publicar.
- **Listo cuando**:
  - Build subida a TestFlight, accesible para tu cuenta de tester interno.
  - Build subida a Play Console internal testing, accesible para testers de la lista.
  - `EAS_SETUP.md` extendido con Fase 8a documentada.
- **Notas**: hasta acá podemos vivir cómodos con distribución interna (link de instalación + ad-hoc) sin tocar stores.

### Fase 8b — EAS Update (OTA)

- **Qué**: Habilitar EAS Update para shippear cambios JS sin rebuildear. Implica configurar canales (`production`, eventualmente `staging`), ejecutar `eas update --branch <branch>` desde CI o manual, y validar que la app pickea el update en runtime.
- **Bloqueador**: ninguno técnico ahora. Conviene esperar a que haya distribución real (post-Fase 8a) o al menos un flujo de testing interno donde tenga sentido shippear iteraciones rápidas.
- **Listo cuando**:
  - `eas update` shipea un cambio JS y se ve reflejado en el simulator/device sin nuevo build nativo.
  - Decidida la política de updates (¿automático en cada push a main? ¿manual?).
  - `EAS_SETUP.md` extendido con Fase 8b documentada.
- **Notas**: solo funciona para cambios que NO requieren rebuild nativo (JS/TS, assets, configs no-nativos). Cambios en `app.json`, módulos nativos, o pods siguen requiriendo `eas build`.

### Fase 8c — Integración CI

- **Qué**: Correr `eas build` desde GitHub Actions automáticamente. Mínimo viable: build de Android en cada push a `main`. Stretch: build paralelo de iOS, validación pre-merge en PRs, gates de typecheck/lint.
- **Bloqueador**: ninguno técnico. Conviene tener resueltas las Fases 8a/8b primero si querés que CI también submitee y/o haga OTA.
- **Listo cuando**:
  - Workflow de GitHub Actions corriendo `pnpm eas:android` (o equivalente) en `main` con `EXPO_TOKEN` en secrets.
  - Build visible en el dashboard de EAS, taggeado con el commit.
  - Documentación de CI agregada a `EAS_SETUP.md` o `.github/workflows/<name>.yml` autoexplicativo.
- **Notas**: cuidado con créditos del free tier de EAS si CI corre builds en cada push (~30/mes). Considerar gatear por tag o branch específico.

---

## Tech debt / Hygiene

### Guardrail CI: detectar versiones duplicadas de React

- **Qué**: Agregar un check de CI que falle si `pnpm why react` reporta más de una versión instalada. Generalizable a `react-dom` y `react-native`.
- **Bloqueador**: ninguno. Pendiente de la Fase 8c (CI base) o se puede agregar como check standalone antes.
- **Listo cuando**:
  - Step de CI que corre algo como `pnpm why react --json | jq '<filter>' | wc -l` y falla si > 1.
  - Idealmente extendido a `react-dom` y `react-native`.
- **Notas**: motivado por el bug del 2026-05-19 — dos versiones de React (web 19.2.4 + mobile 19.1.0) coexistiendo crashearon el bundle de mobile con `Cannot read property 'useRef' of null`. Fix landed en `feature/eas-bootstrap` (alineamos web a 19.1.0). Detalle del incidente en la memoria `project_pnpm_workspace_gotchas.md`.

### Triage de peer dependency warnings

- **Qué**: `pnpm install` reporta "Issues with peer dependencies found". Correr `pnpm peers check`, revisar la lista, addressear lo addressable y/o aceptar explícitamente lo que sea benigno.
- **Bloqueador**: ninguno.
- **Listo cuando**: `pnpm peers check` corre sin warnings, o los warnings restantes están documentados como aceptados.
- **Notas**: común en projects con React Native + monorepo, casi siempre benigno. Pero vale el triage para descartar issues latentes.

### Instalar y correr `expo-doctor`

- **Qué**: Agregar `expo-doctor` como dev dep en `apps/mobile/`, correrlo como parte del flujo de QA local (manual o pre-commit).
- **Bloqueador**: ninguno.
- **Listo cuando**: `pnpm --filter mobile exec expo-doctor` corre sin errores graves, y el comando está documentado en `EAS_SETUP.md` o `README.md` como parte del checklist pre-build.
- **Notas**: `expo-doctor` cachea conocimiento sobre incompatibilidades de versiones de Expo SDK / RN / libs comunes. Podría haber catcheado el bug de Reanimated v4 sin plugin antes de hacer un build.

### README raíz desactualizado sobre `apps/mobile`

- **Qué**: El README raíz (`/README.md`) tiene un párrafo de "Estructura del proyecto" que dice `apps/mobile, todavía no creado`. Eso quedó stale — ya está creado y funcionando.
- **Bloqueador**: ninguno.
- **Listo cuando**: Párrafo actualizado para reflejar que `apps/mobile` existe, incluye `Expo + Expo Router + NativeWind + Supabase + EAS`, y referencia a `apps/mobile/README.md` para detalle.
- **Notas**: low priority pero confuso para alguien que aterriza nuevo en el repo. Cambio chico.

### `apps/web/README.md` simétrico con `apps/mobile/README.md`

- **Qué**: Crear un `apps/web/README.md` con el mismo shape que el de mobile (intro, scripts, convenciones, deploy). Hoy web no tiene README propio — todo vive en el raíz.
- **Bloqueador**: ninguno.
- **Listo cuando**: `apps/web/README.md` existe con scripts table, deploy notes (Vercel), y convenciones específicas; el README raíz se simplifica para apuntar a los apps' READMEs.
- **Notas**: hygiene puro, no urgente. Vale más cuando el repo crezca o entren contributors nuevos.

---

## Cómo cerrar un ítem

1. Hacer el trabajo (en un branch `feature/<tema>` o `chore/<tema>`).
2. Si la fase tiene documentación en `EAS_SETUP.md`, extenderla allá.
3. Borrar la sección correspondiente de este archivo.
4. Si el archivo queda vacío de todo, borrarlo entero — esa es la señal de que terminamos.
