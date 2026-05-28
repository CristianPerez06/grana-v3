import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import type { ButtonProps as ContractButtonProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

const buttonVariants = cva(
  'flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-lg)] text-sm font-medium transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-emerald text-white hover:bg-emerald-deep active:bg-emerald-deep',
        secondary: 'bg-border-soft text-text hover:bg-border active:bg-border',
        ghost: 'bg-transparent text-text-muted hover:bg-border-soft active:bg-border',
        destructive: 'bg-negative/10 text-negative hover:bg-negative/20 active:bg-negative/30',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-11 px-3 text-sm',
        md: 'py-2.5 px-4 text-sm',
        lg: 'py-3 px-5 text-base',
        icon: 'h-9 w-9 p-0 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ContractButtonProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'className' | 'disabled'
  > & {
    asChild?: boolean
  }

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      onPress,
      onClick,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        onClick={onPress ?? onClick}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size="sm" className="text-current" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
