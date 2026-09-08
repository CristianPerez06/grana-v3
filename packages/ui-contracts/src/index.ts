import type { ReactNode } from 'react'

/**
 * UI prop contracts shared between apps/web and apps/mobile.
 *
 * Each primitive UI component (Button, Card, Input, etc.) has two native
 * implementations — one in apps/web/components/ui/ and one in apps/mobile/
 * components/ui/ — because JSX cannot be shared between web and React Native.
 * Both implementations import the prop type from this package so TypeScript
 * fails when the public APIs drift apart.
 *
 * Naming conventions:
 *  - Interaction callbacks use `onPress` (React Native idiomatic) on both
 *    sides. Web implementations map `onPress` to `onClick` internally.
 *  - Each app MAY extend the contract via intersection with platform-specific
 *    props (e.g. a `hapticFeedback` on mobile, an `asChild` on web). It MUST
 *    NOT rename, retype or hide the common props.
 *
 * See packages/ui-contracts/README.md for the full policy.
 */

// ── Alert ───────────────────────────────────────────────────────────────────

export type AlertVariant = 'info' | 'success' | 'error' | 'warning'

export type AlertProps = {
  variant?: AlertVariant
  title?: string
  /**
   * Body of the alert. Web accepts ReactNode (text or JSX). Mobile renders
   * strings inside `<Text>`; passing JSX to mobile is not supported today.
   */
  children?: ReactNode
  className?: string
}

// ── Button ──────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'link'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'fab'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  /**
   * Press handler. Use `onPress` (not `onClick`) on both platforms. The web
   * implementation maps it to the underlying DOM `onClick`.
   */
  onPress?: () => void
  children?: ReactNode
  className?: string
}

// ── Card (and subcomponents) ────────────────────────────────────────────────

export type CardProps = {
  className?: string
  children?: ReactNode
}

// CardHeader, CardTitle, CardDescription, CardContent and CardFooter all share
// the same surface: a className and children. They are intentionally typed the
// same so each implementation can map them to its native primitive (`<div>` /
// `<h3>` / `<p>` on web; `<View>` / `<Text>` on mobile).
export type CardHeaderProps = CardProps
export type CardTitleProps = CardProps
export type CardDescriptionProps = CardProps
export type CardContentProps = CardProps
export type CardFooterProps = CardProps

// ── Input ───────────────────────────────────────────────────────────────────

export type InputProps = {
  invalid?: boolean
  className?: string
}

// ── MoneyAmountInput ────────────────────────────────────────────────────────

// Bare input primitive for money fields. The contract intentionally does NOT
// include the value callback — web uses `onChange` and mobile uses
// `onChangeText`, same per-platform asymmetry as `Input`. Each implementation
// intersects with its native value prop.
export type MoneyAmountInputProps = {
  className?: string
}

// ── Label ───────────────────────────────────────────────────────────────────

export type LabelProps = {
  className?: string
  children?: ReactNode
}

// ── FormField ───────────────────────────────────────────────────────────────

export type FormFieldProps = {
  label: string
  error?: string
  description?: string
}

// ── PasswordField ───────────────────────────────────────────────────────────

export type PasswordFieldProps = FormFieldProps & {
  toggleLabelShow?: string
  toggleLabelHide?: string
}

// ── Spinner ─────────────────────────────────────────────────────────────────

export type SpinnerSize = 'sm' | 'md' | 'lg'

export type SpinnerProps = {
  size?: SpinnerSize
  className?: string
  /**
   * Accessible label announced by screen readers. Web sets `aria-label`;
   * mobile sets `accessibilityLabel`.
   */
  label?: string
}

// ── PageHeader ──────────────────────────────────────────────────────────────

export type PageHeaderBackLink = {
  href: string
  label: string
}

export type PageHeaderProps = {
  /**
   * Title rendered as the page-level heading. Required.
   */
  title: string
  /**
   * Optional one-line description rendered immediately below the title,
   * inside the header block so the visual cohesion is preserved (the page
   * wrapper's gap does not separate them). Use sentence case, no period.
   */
  description?: string
  /**
   * Optional inline node appended at the end of the `description` (web only).
   * Used for contextual links like "· Ver recurrencias →". Mobile MAY ignore
   * this prop and surface the same affordance through a platform-native
   * control if needed.
   */
  descriptionExtras?: ReactNode
  /**
   * Optional back link rendered above the title. When provided, both `href`
   * and `label` are required — the object shape forbids the half-defined
   * state at the type level.
   *
   * Below `md` the header renders without a tab bar in the sections reached
   * from the menu, so there the back link is the screen's only visible way
   * out. Its slot is reserved even when absent, to keep the header's height
   * stable across a section's routes.
   */
  backLink?: PageHeaderBackLink
  /**
   * Optional slot rendered on the right side of the title row. Intended for
   * page-level actions (a button, a dropdown, a small action group). Not a
   * general right-side slot; the contract narrows it to actions on purpose.
   */
  actions?: ReactNode
  className?: string
}

// ── SettingsSection ─────────────────────────────────────────────────────────

export type SettingsSectionProps = {
  /**
   * Section header rendered in small uppercase muted style above the card.
   * Required — every settings section has a heading.
   */
  title: string
  children?: ReactNode
  className?: string
}

// ── ShowCentsToggle ─────────────────────────────────────────────────────────

export type ShowCentsToggleProps = {
  /**
   * Current value of the preference. The component is presentational and
   * controlled — it does not own the state or the persistence.
   */
  value: boolean
  /**
   * Called when the user toggles the switch. The parent decides how to
   * persist (cookie on web, SecureStore on mobile) and re-render consumers.
   */
  onValueChange: (next: boolean) => void
  /**
   * Whether the control is in a pending/transitioning state. The component
   * SHOULD disable interaction and reduce visual emphasis while true.
   */
  disabled?: boolean
  /**
   * Label rendered next to the switch (e.g. "Mostrar centavos").
   */
  label: string
  /**
   * Optional helper copy under the label.
   */
  description?: string
  className?: string
}

// ── LanguageSwitcher ────────────────────────────────────────────────────────

export type LanguageSwitcherProps<TLocale extends string = string> = {
  /**
   * The active locale. Used to highlight the selected option.
   */
  current: TLocale
  /**
   * The set of supported locales, in the order they should render.
   */
  locales: readonly TLocale[]
  /**
   * Called when the user selects a locale. The parent decides how to
   * persist (cookie on web, SecureStore on mobile) and trigger re-render.
   */
  onSelect: (locale: TLocale) => void
  /**
   * Whether the control is in a pending state. Both platforms SHOULD
   * disable buttons while true to prevent double-fire during persistence.
   */
  disabled?: boolean
  /**
   * Maps a locale code to its per-locale segment button label (e.g.
   * 'es' -> 'Español'). Distinct from `label` below: `renderLabel` is the
   * label ON each control button, `label` is the row's title.
   * Lifted so the contract does not depend on a particular i18n system.
   */
  renderLabel: (locale: TLocale) => string
  /**
   * Accessibility label for the group as a whole (e.g. "Idioma").
   */
  ariaLabel: string
  /**
   * Optional row title shown to the left of the control (e.g. "Idioma de la
   * aplicación"). When provided, the component renders as a settings row
   * (copy left, control right), symmetric with `ShowCentsToggle`. Optional so
   * a control-only consumer (e.g. mobile until its settings row is built)
   * keeps compiling and renders just the control.
   */
  label?: string
  /**
   * Optional row description shown under `label`. Only meaningful alongside
   * `label`.
   */
  description?: string
  className?: string
}

// ── GranaLogo / GranaIsotype ──────────────────────────────────────────────────

// The brand logo. Two marks: the full `grana` wordmark and the square `$`
// isotype used as app icon / avatar. Both render with Bricolage Grotesque 800,
// which each app loads in its shell (next/font on web, expo-font on mobile).
// Colors default to the brand palette (mirrors @grana/ui-tokens --navy/--emerald)
// but stay overridable so the marks can be inverted on dark surfaces.

export type GranaLogoProps = {
  /** Render width in px. Height derives from the 540×260 viewBox. */
  width?: number
  /** Wordmark color. Defaults to brand navy. */
  fg?: string
  /** Color of the disc holding the `$` counter. Defaults to brand emerald. */
  accent?: string
  /** Color of the `$` glyph inside the disc. Defaults to white. */
  glyph?: string
  /** Accessible title announced by screen readers. */
  title?: string
  className?: string
}

export type GranaIsotypeProps = {
  /** Square size in px. */
  size?: number
  /** Background color. Defaults to brand navy. */
  bg?: string
  /** Color of the `$` glyph. Defaults to brand emerald. */
  fg?: string
  /**
   * Corner radius in px relative to `size`. Defaults to ~22.5% of size, the
   * iOS app-icon standard — match it so the squircle reads as an app mark.
   */
  radius?: number
  /** Accessible title announced by screen readers. */
  title?: string
  className?: string
}

// ── RouteError ──────────────────────────────────────────────────────────────

export type RouteErrorProps = {
  /**
   * The error caught by the route-level boundary. On web this is the value
   * passed to Next.js `error.tsx` (may include a `digest` in production). On
   * mobile this is typically the `error` returned by a TanStack Query hook.
   */
  error: Error & { digest?: string }
  /**
   * Domain-named retry callback. Not `onPress`/`onClick`: this is a domain
   * action (re-run the failed work), not a generic interaction wrapper.
   * Web wires it to Next's `reset()`; mobile wires it to `query.refetch()`.
   */
  onRetry: () => void
  className?: string
}

// ── RouteNotFound ───────────────────────────────────────────────────────────

/**
 * Sibling to RouteError, surfaced when a route's resource doesn't exist (Next's
 * `notFound()`) instead of when work threw. The caller passes already-translated
 * strings — the primitive stays agnostic of the i18n namespace so per-module
 * not-found.tsx files can choose their own copy.
 *
 * No callback (e.g. `onRetry`): the semantics are navigation to a known
 * starting point, not retry. The action is a link to `backHref`.
 */
export type RouteNotFoundProps = {
  title: string
  description: string
  backHref: string
  backLabel: string
  className?: string
}

// ── AccountAvatar (account visual identity) ───────────────────────────────────

/**
 * Curated account color palette. Each key maps to a `--account-<key>` CSS var
 * in @grana/ui-tokens (web utilities `bg-account-<key>`) and to
 * `tokens.colors['account-<key>'].DEFAULT` (mobile, via @grana/ui-tokens/tokens).
 * Keep this list in sync with theme.css — guarded by a token-sync test.
 */
export const ACCOUNT_COLOR_KEYS = [
  'slate',
  'indigo',
  'violet',
  'plum',
  'magenta',
  'teal',
  'cyan',
  'clay',
] as const
export type AccountColorKey = (typeof ACCOUNT_COLOR_KEYS)[number]

/**
 * Hex value for each curated account color. Mirror of the `--account-<key>`
 * CSS vars in @grana/ui-tokens (theme.css) — used by features that need to
 * store the hex itself (e.g. `institutions.brand_color`), not just the key.
 * Keep in sync with theme.css.
 */
export const ACCOUNT_COLOR_HEX: Record<AccountColorKey, string> = {
  slate: '#3A6B8A',
  indigo: '#4C56C0',
  violet: '#7B57C0',
  plum: '#8A6E98',
  magenta: '#C04D86',
  teal: '#1F8F9C',
  cyan: '#2C7FB8',
  clay: '#A8794E',
}

export const ACCOUNT_COLOR_HEX_VALUES = Object.values(ACCOUNT_COLOR_HEX) as readonly string[]

/**
 * Valid values for `institutions.icon_type`. Drives which lucide icon the
 * avatar resolver picks for a bank account when no explicit `icon_key` is set
 * (`bank` → landmark, `wallet` → wallet).
 */
export const INSTITUTION_ICON_TYPES = ['bank', 'wallet'] as const
export type InstitutionIconType = (typeof INSTITUTION_ICON_TYPES)[number]

/**
 * Curated account icon set. Each key is a lucide icon name; each platform maps
 * it to its own lucide implementation (`lucide-react` on web,
 * `lucide-react-native` on mobile). Only the key (a string) is shared.
 */
export const ACCOUNT_ICON_KEYS = [
  'wallet',
  'banknote',
  'piggy-bank',
  'coins',
  'vault',
  'briefcase',
  'dollar-sign',
  'landmark',
  'credit-card',
  'building-2',
  'house',
  'car',
  'plane',
  'graduation-cap',
  'gift',
  'hand-coins',
] as const
export type AccountIconKey = (typeof ACCOUNT_ICON_KEYS)[number]

/** Minimal account shape the resolver needs. */
export type AccountAvatarInput = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  color_key: string | null
  icon_key: string | null
}

/** Institution branding used for the live-inheritance path (bank accounts). */
export type AccountInstitutionBranding = {
  brand_color: string | null
  /** 'bank' | 'wallet' in the catalog; any other value falls back to 'landmark'. */
  icon_type: string | null
}

/**
 * Fully resolved avatar. Color is expressed as EITHER a palette key (curated
 * colors, rendered via token) OR a raw CSS color override (an institution's
 * `brand_color`, which is not part of the curated palette). Exactly one of
 * `colorKey` / `colorOverride` is non-null.
 */
export type ResolvedAccountAvatar = {
  colorKey: AccountColorKey | null
  colorOverride: string | null
  /** Resolved icon key, or null to fall back to the monogram. */
  iconKey: AccountIconKey | null
  /** Single-letter fallback (uppercased first letter of the account name). */
  monogram: string
}

/** Props for the platform `AccountAvatar` components — already resolved. */
export type AccountAvatarSize = 'sm' | 'md'
export type AccountAvatarProps = ResolvedAccountAvatar & {
  size?: AccountAvatarSize
  className?: string
}

function isAccountColorKey(value: string | null): value is AccountColorKey {
  return value !== null && (ACCOUNT_COLOR_KEYS as readonly string[]).includes(value)
}

function isAccountIconKey(value: string | null): value is AccountIconKey {
  return value !== null && (ACCOUNT_ICON_KEYS as readonly string[]).includes(value)
}

/** Deterministic FNV-1a hash → index, so the same id always maps to the same color. */
function hashToIndex(id: string, modulo: number): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % modulo
}

/**
 * Pure resolver for an account's avatar. Resolution rules:
 *  - color: explicit `color_key` (override) > bank/credit live-inherit
 *    institution `brand_color` > deterministic palette color from the account id.
 *  - icon: explicit `icon_key` (override) > bank derives from institution
 *    `icon_type` ('wallet' → wallet, else landmark) > cash default 'wallet'.
 *  - monogram: uppercased first letter of the name (component fallback when
 *    `iconKey` is null).
 */
export function resolveAccountAvatar(
  account: AccountAvatarInput,
  institution?: AccountInstitutionBranding | null,
): ResolvedAccountAvatar {
  const trimmed = account.name.trim()
  const monogram = (trimmed.length > 0 ? trimmed[0] : '?').toUpperCase()

  let colorKey: AccountColorKey | null = null
  let colorOverride: string | null = null
  if (isAccountColorKey(account.color_key)) {
    colorKey = account.color_key
  } else if (
    (account.type === 'bank' || account.type === 'credit') &&
    institution?.brand_color
  ) {
    colorOverride = institution.brand_color
  } else {
    colorKey = ACCOUNT_COLOR_KEYS[hashToIndex(account.id, ACCOUNT_COLOR_KEYS.length)]
  }

  let iconKey: AccountIconKey | null
  if (isAccountIconKey(account.icon_key)) {
    iconKey = account.icon_key
  } else if (account.type === 'bank') {
    iconKey = institution?.icon_type === 'wallet' ? 'wallet' : 'landmark'
  } else {
    iconKey = 'wallet'
  }

  return { colorKey, colorOverride, iconKey, monogram }
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export type DrawerSide = 'right' | 'left'

/**
 * Side panel that slides in over a scrim. Controlled (`open` + `onClose`).
 * Web closes on scrim click and Esc, traps focus while open and restores it on
 * close. Mobile presents it as a full-height native modal sliding from `side`.
 */
export type DrawerProps = {
  open: boolean
  onClose: () => void
  /** Side the panel is anchored to. Defaults to 'right'. */
  side?: DrawerSide
  /** Web panel width in px. Defaults to 528. Mobile may render full-width. */
  widthPx?: number
  /** Accessible name for the dialog. */
  ariaLabel: string
  children?: ReactNode
  className?: string
}

// ── Popover ─────────────────────────────────────────────────────────────────

export type PopoverAlign = 'start' | 'center' | 'end'

/**
 * Content anchored to a `trigger`. Controlled (`open` + `onOpenChange`). Web
 * positions it under the trigger and flips above when it doesn't fit, closing
 * on outside click, Esc and scroll. Mobile presents the content as a sheet
 * anchored to the trigger (API parity; exact placement may differ per platform
 * per the Web↔Mobile policy).
 */
export type PopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The anchor element the popover is attached to. */
  trigger: ReactNode
  /** Alignment of the content relative to the trigger. Defaults to 'start'. */
  align?: PopoverAlign
  /** Min content width in px. Defaults to 280. */
  minWidthPx?: number
  /** Max content width in px. Defaults to 340. */
  maxWidthPx?: number
  /**
   * Modal popover: traps focus and owns its own scroll lock. Set this when the
   * popover is opened from inside another scroll-locked overlay (e.g. a Drawer),
   * so its scrollable content can be scrolled on wheel/touch instead of being
   * swallowed by the host overlay's lock. Defaults to false (web). Ignored on
   * mobile, where the popover is always a native bottom-sheet modal.
   */
  modal?: boolean
  children?: ReactNode
  className?: string
}

// ── Segmented ─────────────────────────────────────────────────────────────────

export type SegmentedOption = {
  value: string
  /** Label content — plain text, or an icon + text node (web). */
  label: ReactNode
  /** A disabled option cannot be selected; it never fires onValueChange. */
  disabled?: boolean
}

/**
 * Single-select segmented control. Controlled (`value` + `onValueChange`).
 * Exactly one option is active and visually elevated.
 */
export type SegmentedProps = {
  value: string
  options: SegmentedOption[]
  onValueChange: (value: string) => void
  /** Accessible name for the group (radiogroup). */
  ariaLabel: string
  className?: string
}

// ── Switch ──────────────────────────────────────────────────────────────────

/**
 * On/off switch. Controlled (`checked` + `onValueChange`). `on` uses the
 * positive accent. Respects `disabled` (never fires onValueChange).
 */
export type SwitchProps = {
  checked: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  /** Accessible name for the switch. */
  ariaLabel: string
  className?: string
}

// ── Household (Compartido domain shape) ───────────────────────────────────────

// The active shared household as consumed by the UI (movement form's "Compartir"
// toggle, the settings split editor, the Hogar module). Canonical home for this
// shape: `@grana/movement-form` and `@grana/shared` both re-export it from here,
// so there is exactly one definition across web + mobile. Not a component prop
// contract, but the neutral cross-package shape home — same role this package
// already plays for `AccountAvatarInput` and friends.

export type HouseholdMember = {
  userId: string
  fullName: string
  isCreator: boolean
}

export type Household = {
  id: string
  name: string
  members: HouseholdMember[]
  defaultSplit: { user_id: string; percentage: number }[]
}

// ── MonthSheet (dashboard month lens) ────────────────────────────────────────

// The sheet the dashboard's date line opens to pick which month the numbers are
// read from. Two implementations — a bottom sheet below `md` on web, a `Modal`
// overlay on native — one contract, so a divergence breaks TypeScript on the
// other side.
//
// The month data (`years`) is NOT shaped here: it comes from
// `reachableMonths()` in `@grana/dashboard`, which owns the range rule and the
// labels so both platforms show the same grid by construction.

export type MonthSheetSelection = {
  year: number
  month: number
}

export type MonthSheetMonth = MonthSheetSelection & {
  /** Short label already localized ("Sep"). */
  label: string
  /** Out-of-range months render visible but disabled, never absent. */
  reachable: boolean
}

export type MonthSheetYear = {
  year: number
  /** The full calendar year, January first. */
  months: MonthSheetMonth[]
}

export type MonthSheetProps = {
  open: boolean
  /** Calendar years to render, newest first. */
  years: MonthSheetYear[]
  /** The month currently being looked at, marked as such in the grid. */
  selected: MonthSheetSelection
  /** Picking a month applies it and closes the sheet. */
  onSelect: (month: MonthSheetSelection) => void
  /** Scrim, gesture or Escape. MUST NOT change the selection. */
  onDismiss: () => void
}
