## MODIFIED Requirements

### Requirement: La app mobile arranca correctamente

`apps/mobile` SHALL ser un proyecto Expo válido que arranque sin errores en el simulador de iOS o en un dispositivo Android. La pantalla raíz SHALL resolver el estado de sesión de Supabase y redirigir al usuario al área correspondiente — sin pasar por una pantalla placeholder.

La resolución inicial vive en `app/index.tsx`: se llama a `supabase.auth.getSession()` y se emite `<Redirect />` durante el render. El `app/_layout.tsx` raíz suscribe `supabase.auth.onAuthStateChange` y reacciona a `SIGNED_IN` / `SIGNED_OUT` redirigiendo a `(app)/dashboard` o `(auth)/login` respectivamente. Las rutas autenticadas viven bajo el grupo `(app)/`; las no autenticadas, bajo `(auth)/`.

Una vez aterrizado en `(app)/dashboard`, la pantalla SHALL renderizar el dashboard completo (las cuatro secciones definidas por la capability `dashboard`) y NO un placeholder de texto. La responsabilidad de implementar esa pantalla vive en la capability `dashboard`; el shell solo provee la ruta y el shell de tabs/menú a su alrededor.

#### Scenario: El dev server arranca desde la raíz del monorepo

- **WHEN** un desarrollador ejecuta `pnpm dev:mobile` desde la raíz del monorepo
- **THEN** el servidor de desarrollo de Expo arranca sin errores de resolución de módulos
- **AND** el QR code o la URL de dev client quedan disponibles en la terminal

#### Scenario: Arranque sin sesión activa lleva a login

- **WHEN** un usuario abre la app sin haber iniciado sesión nunca (o tras un `signOut`)
- **THEN** `app/index.tsx` resuelve `getSession()` con `null`
- **AND** la app aterriza en `(auth)/login` sin renderizar ninguna pantalla intermedia más allá del `ActivityIndicator` momentáneo

#### Scenario: Arranque con sesión activa lleva al dashboard renderizado

- **WHEN** un usuario abre la app con una sesión válida persistida en `expo-secure-store`
- **THEN** `app/index.tsx` resuelve `getSession()` con una sesión
- **AND** la app aterriza en `(app)/dashboard` con el dashboard renderizado (Hero, Lo que viene, Balance del mes, Tarjetas)
- **AND** la pantalla NO muestra el placeholder de texto "Dashboard"
