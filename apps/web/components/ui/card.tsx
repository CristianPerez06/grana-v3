import { forwardRef, type HTMLAttributes } from 'react'
import type {
  CardContentProps as ContractCardContentProps,
  CardDescriptionProps as ContractCardDescriptionProps,
  CardFooterProps as ContractCardFooterProps,
  CardHeaderProps as ContractCardHeaderProps,
  CardProps as ContractCardProps,
  CardTitleProps as ContractCardTitleProps,
} from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

type DivProps<T extends HTMLElement = HTMLDivElement> = Omit<
  HTMLAttributes<T>,
  'className' | 'children'
>

// `variant` is a web-local extension (intersection over the shared contract):
// it stays out of `@grana/ui-contracts` so mobile is not forced to implement
// it. Promote it to the contract when mobile needs the same surface variant.
type CardProps = ContractCardProps & { variant?: 'default' | 'emerald' } & DivProps
type CardHeaderProps = ContractCardHeaderProps & DivProps
type CardTitleProps = ContractCardTitleProps & DivProps<HTMLHeadingElement>
type CardDescriptionProps = ContractCardDescriptionProps &
  DivProps<HTMLParagraphElement>
type CardContentProps = ContractCardContentProps & DivProps
type CardFooterProps = ContractCardFooterProps & DivProps

// Card surfaces (border + background) by variant. The shell carries the
// canonical card radius (`rounded-2xl` = token `--radius-2xl`) and shadow; it
// holds NO padding of its own — padding lives in CardHeader/CardContent/
// CardFooter (composable model).
const CARD_VARIANTS: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'border-border bg-card',
  emerald: 'border-emerald/30 bg-emerald/5',
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border text-foreground shadow-sm',
        CARD_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-text-muted', className)}
      {...props}
    />
  ),
)
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
