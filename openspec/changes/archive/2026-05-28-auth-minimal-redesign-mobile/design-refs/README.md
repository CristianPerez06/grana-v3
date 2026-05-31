# Auth redesign — design references (mobile / native)

**Non-authoritative.** This change shipped the React Native (Expo) implementation in `apps/mobile/components/layout/AuthShell.tsx` and the screens under `apps/mobile/app/(auth)/`. The visual direction is the same "minimal centered card" used by the web change — the mobile app mirrors the web-mobile layout (390-wide centered card on `bg-page`, logo inside the card, single emerald accent), translated to native primitives.

No dedicated React Native artboards were produced for this change. The closest visual references are the **Web Mobile 390** artboards in the sibling change's design-refs:

- `../../2026-05-28-auth-minimal-redesign/design-refs/login-web-mobile-390.png` (+ `.svg`)
- `../../2026-05-28-auth-minimal-redesign/design-refs/signup-web-mobile-390.png` (+ `.svg`)
- `../../2026-05-28-auth-minimal-redesign/design-refs/forgot-password-web-mobile-390.png` (+ `.svg`)

Differences in the native build are idiomatic, not visual: `SafeAreaView edges={['top']}` instead of the web's status-bar padding, `<Stack screenOptions={{ headerShown: false }} />` to suppress the native stack header, and `<PageHeader />` used consistently across root + nested routes (see [[feedback_mobile_headers]] in agent memory). Layout proportions and copy match the web-mobile refs 1:1.

Do **not** translate hex literals from those refs into the native styles — use `@grana/ui-tokens` (TS mirror, once codegen is in place) instead of inline values.
