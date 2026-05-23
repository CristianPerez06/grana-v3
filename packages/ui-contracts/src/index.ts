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

export type ButtonSize = 'sm' | 'md' | 'lg'

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
   * Optional back link rendered above the title. When provided, both `href`
   * and `label` are required — the object shape forbids the half-defined
   * state at the type level.
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
