import { Suspense } from 'react'
import { EditChrome } from './_components/edit-chrome'

const EditMovementLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6 max-w-lg">
    <Suspense fallback={<div className="h-14" aria-hidden />}>
      <EditChrome />
    </Suspense>
    {children}
  </div>
)

export default EditMovementLayout
