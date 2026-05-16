import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-md border p-4 text-sm flex gap-3 items-start',
  {
    variants: {
      variant: {
        info: 'border-info/30 bg-info/10 text-info',
        success: 'border-success/30 bg-success/10 text-success',
        error: 'border-destructive/30 bg-destructive/10 text-destructive',
        warning: 'border-warning/30 bg-warning/10 text-warning',
      },
    },
    defaultVariants: { variant: 'info' },
  },
)

const iconMap = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
} as const

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    title?: string
    icon?: ReactNode | false
  }

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, icon, children, ...props }, ref) => {
    const Icon = iconMap[variant ?? 'info']
    const showIcon = icon !== false
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {showIcon && (
          <span className="mt-0.5 shrink-0">
            {icon ?? <Icon className="h-4 w-4" aria-hidden />}
          </span>
        )}
        <div className="flex flex-col gap-1">
          {title && <p className="font-medium leading-none">{title}</p>}
          {children && <div className="leading-snug">{children}</div>}
        </div>
      </div>
    )
  },
)
Alert.displayName = 'Alert'

export { Alert, alertVariants }
export type { AlertProps }
