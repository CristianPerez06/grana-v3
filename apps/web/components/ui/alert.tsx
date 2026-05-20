import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-md border p-4 text-sm flex gap-3 items-start',
  {
    variants: {
      variant: {
        info: 'border-slate/20 bg-slate-soft text-slate',
        success: 'border-emerald/20 bg-emerald-soft text-emerald-deep',
        error: 'border-error/20 bg-error-soft text-error-deep',
        warning: 'border-warning/20 bg-warning-soft text-warning-deep',
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
