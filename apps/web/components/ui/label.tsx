import * as LabelPrimitive from '@radix-ui/react-label'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import type { LabelProps as ContractLabelProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

type LabelProps = ContractLabelProps &
  Omit<
    ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    'children' | 'className'
  >

const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none text-text peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }
export type { LabelProps }
