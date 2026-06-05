## ADDED Requirements

### Requirement: La creación de categorías y subcategorías ocurre en un drawer (web, EXPLORATION)

`apps/web` SHALL ofrecer la creación de categorías (`/settings/categories`) y subcategorías (`/settings/categories/[id]/subcategories`) como una experiencia de drawer modal disparada desde el header del listado, alineada con el patrón ya consolidado en `accounts` (`<CreateAccountButton />` + `<CreateAccountForm variant="drawer">`) y `cards` (`<AddCardButton />`). Las pages `/settings/categories/new` y `/settings/categories/[id]/subcategories/new` SHALL mantenerse como fallback no-JS, con su form rendido en `variant="page"`.

**Estado:** EXPLORATION-STAGE. Este requirement es un placeholder que documenta la dirección sin congelarla. Las "Open Questions" del `proposal.md` de este change deben resolverse y este requirement debe re-escribirse con un contrato verificable antes de cerrar la exploración. NO debe archivarse este change hasta que ese refactor del spec ocurra. El contrato final (props del trigger, callbacks del form, comportamiento mobile-web full-screen, si la edición también migra a drawer) queda por definir durante la exploración referenciada en `proposal.md`.

#### Scenario: TBD — definir durante la exploración

- **WHEN** la exploración referenciada en `proposal.md` resuelva las Open Questions (1–5) y se decida el contrato concreto del trigger, del form y de la dependencia con `/edit`
- **THEN** este scenario se reescribe con un par WHEN/THEN verificable contra `apps/web/app/(app)/settings/categories/_components/`
- **AND** se agregan scenarios adicionales para cubrir el fallback no-JS, el comportamiento mobile-web del drawer, y el patrón análogo de subcategorías
