# Auth redesign — design references (web)

**Non-authoritative.** These are point-in-time exports of the Paper artboards used to align on the "minimal centered card" direction for the auth screens. The shipped implementation lives in `apps/web/components/layout/auth-shell.tsx` and the route components under `apps/web/app/(auth)/`.

Do **not** copy hex values, `text-[15px]` literals, or arbitrary px values from these refs into the codebase — translate to tokens from `@grana/ui-tokens` (Tailwind v4 CSS-first).

## Files

| Artboard                          | PNG (2x)                                  | SVG (vector)                              |
| --------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Login — Desktop 1440              | `login-desktop-1440.png`                  | `login-desktop-1440.svg`                  |
| Signup — Desktop 1440             | `signup-desktop-1440.png`                 | `signup-desktop-1440.svg`                 |
| Forgot Password — Desktop 1440    | `forgot-password-desktop-1440.png`        | `forgot-password-desktop-1440.svg`        |
| Login — Web Mobile 390            | `login-web-mobile-390.png`                | `login-web-mobile-390.svg`                |
| Signup — Web Mobile 390           | `signup-web-mobile-390.png`               | `signup-web-mobile-390.svg`               |
| Forgot Password — Web Mobile 390  | `forgot-password-web-mobile-390.png`      | `forgot-password-web-mobile-390.svg`      |

`signup-desktop-1440.reference.jsx` is the JSX export of the richest desktop screen (Signup has the password helper text and the footer links). Same caveat applies — it is a structural reference, not source.

## Captured

- Tool: Paper MCP (`paper.design`) — file "Grana V3 — Desktop", page "Grana V3".
- Date: 2026-05-31.
- Palette anchor: `#0B1A2B` ink, `#10B981` emerald accent (`#059669` for active link state), `#F6F7F9` page bg, `#E6EAEF` border, `#6B7683` / `#8A94A3` muted copy. All map to existing tokens in `@grana/ui-tokens`.
