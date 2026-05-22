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
