import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  CurvedNavyHeader,
  type CurvedNavyHeaderProps,
} from './curved-navy-header'

type CurvedNavyContainerProps = CurvedNavyHeaderProps & {
  children: ReactNode
  contentClassName?: string
}

const CurvedNavyContainer = ({
  children,
  contentClassName,
  ...headerProps
}: CurvedNavyContainerProps) => (
  <div className="min-h-screen flex flex-col bg-page">
    <CurvedNavyHeader {...headerProps} />
    <main
      className={cn(
        'mx-auto w-full max-w-[430px] flex-1 px-5 pt-8 pb-10',
        contentClassName,
      )}
    >
      {children}
    </main>
  </div>
)

export { CurvedNavyContainer }
export type { CurvedNavyContainerProps }
