'use client'

import { useState } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { Calculator, Delete } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { evaluateMoneyExpression } from '@grana/validation'
import { useDrawerContainer } from '@/components/ui/drawer'
import { formatForDisplay } from '@/lib/money-input-format'
import { cn } from '@/lib/utils'

// MoneyCalculatorPopover — a calculator-icon trigger that opens a numeric keypad
// for building an arithmetic expression, resolving it via the shared
// `evaluateMoneyExpression`, and filling the associated money field with the
// canonical result. Opt-in adornment for `MoneyAmountInput`'s primary fields.
//
// Inside a Drawer the content is portaled into the drawer panel (not body) so
// the Dialog's scroll-lock lets it render/scroll — see `useDrawerContainer`.

type Props = {
  // Called with the canonical result (plain digits + optional `.` decimal) when
  // the user applies a computed value.
  onResult: (canonical: string) => void
  // Seed the keypad with the field's current value when opening.
  seed?: string
  // Reject a negative result (most money fields are non-negative).
  allowNegative?: boolean
  className?: string
}

export const MoneyCalculatorPopover = ({ onResult, seed, allowNegative = false, className }: Props) => {
  const t = useTranslations('common.calculator')
  const drawerContainer = useDrawerContainer()
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState('')

  const preview = evaluateMoneyExpression(expr)
  const previewValid = preview !== null && (allowNegative || preview >= 0)

  const openWithSeed = (next: boolean) => {
    if (next) setExpr(seed && seed !== '0' ? seed : '')
    setOpen(next)
  }

  const push = (v: string) => setExpr((e) => e + v)
  const append = (v: string) => () => push(v)
  const backspace = () => setExpr((e) => e.slice(0, -1))
  const clear = () => setExpr('')

  const apply = () => {
    if (!previewValid) return
    onResult(String(preview))
    setOpen(false)
  }

  // Physical-keyboard support while the pad is open: the popover holds focus
  // (not the field), so without this typing digits would do nothing. Operators
  // are normalised to the display glyphs (× ÷) and the decimal to the es-AR `,`.
  const handleKey = (e: React.KeyboardEvent) => {
    const k = e.key
    if (k >= '0' && k <= '9') return void (e.preventDefault(), push(k))
    switch (k) {
      case '+':
      case '(':
      case ')':
        return void (e.preventDefault(), push(k))
      case '-':
        return void (e.preventDefault(), push('-'))
      case '*':
      case 'x':
      case 'X':
        return void (e.preventDefault(), push('×'))
      case '/':
        return void (e.preventDefault(), push('÷'))
      case '.':
      case ',':
        return void (e.preventDefault(), push(','))
      case 'Backspace':
        return void (e.preventDefault(), backspace())
      case 'Enter':
      case '=':
        return void (e.preventDefault(), apply())
      // Escape falls through to Radix, which closes the popover.
    }
  }

  // Shared key styles. `num` = digits/decimal, `op` = operators, `ctrl` = C/⌫.
  const key =
    'flex h-11 select-none items-center justify-center rounded-[10px] text-[17px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:brightness-95'
  const num = cn(key, 'bg-page text-text hover:bg-border-soft')
  const op = cn(key, 'bg-border-soft text-navy')
  const ctrl = cn(key, 'bg-border-soft text-[14px] font-bold text-text-muted')

  // The digit/operator grid, row-major. `label` is what the key shows, `v` is
  // the character appended to the expression (× ÷ and es-AR `,` are understood
  // by the evaluator); `0` spans two columns.
  const pad: { label: string; v: string; op?: boolean; span2?: boolean }[] = [
    { label: '7', v: '7' }, { label: '8', v: '8' }, { label: '9', v: '9' }, { label: '÷', v: '÷', op: true },
    { label: '4', v: '4' }, { label: '5', v: '5' }, { label: '6', v: '6' }, { label: '×', v: '×', op: true },
    { label: '1', v: '1' }, { label: '2', v: '2' }, { label: '3', v: '3' }, { label: '−', v: '-', op: true },
    { label: '0', v: '0', span2: true }, { label: ',', v: ',' }, { label: '+', v: '+', op: true },
  ]

  return (
    <RadixPopover.Root open={open} onOpenChange={openWithSeed} modal={false}>
      <RadixPopover.Trigger asChild>
        <button
          type="button"
          aria-label={t('open')}
          className={cn(
            'flex size-8 items-center justify-center rounded-[9px] text-text-soft transition-colors hover:bg-border-soft hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Calculator className="size-[18px]" />
        </button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal container={drawerContainer ?? undefined}>
        <RadixPopover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          role="dialog"
          aria-label={t('title')}
          onKeyDown={handleKey}
          className="grana-popover z-50 w-[252px] rounded-[var(--radius-xl)] border border-border bg-card p-3 shadow-[0_20px_50px_-12px_rgba(11,26,43,0.30)] outline-none"
        >
          {/* Display: running expression + live grouped result */}
          <div className="mb-2 rounded-[10px] bg-page px-3 py-2 text-right">
            <div className="min-h-[18px] truncate text-[13px] text-text-soft" aria-hidden>
              {expr || ' '}
            </div>
            <div className="truncate text-[22px] font-bold tabular-nums text-text">
              {previewValid ? formatForDisplay(String(preview)) : expr ? '—' : '0'}
            </div>
          </div>

          {/* Keys are tabIndex -1 so focus stays on the popover content, where
              handleKey drives the pad from the physical keyboard; the mouse
              still clicks them. */}
          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" tabIndex={-1} onClick={clear} aria-label={t('clear')} className={ctrl}>
              C
            </button>
            <button type="button" tabIndex={-1} onClick={backspace} aria-label={t('backspace')} className={cn(ctrl, 'text-[0]')}>
              <Delete className="size-[18px]" aria-hidden />
            </button>
            <button type="button" tabIndex={-1} onClick={append('(')} className={op}>
              (
            </button>
            <button type="button" tabIndex={-1} onClick={append(')')} className={op}>
              )
            </button>

            {pad.map((k) => (
              <button
                key={k.label}
                type="button"
                tabIndex={-1}
                onClick={append(k.v)}
                className={cn(k.op ? op : num, k.span2 && 'col-span-2')}
              >
                {k.label}
              </button>
            ))}

            <button
              type="button"
              tabIndex={-1}
              onClick={apply}
              disabled={!previewValid}
              className={cn(key, 'col-span-4 bg-navy text-white hover:brightness-110 disabled:opacity-40')}
            >
              {t('apply')}
            </button>
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}
