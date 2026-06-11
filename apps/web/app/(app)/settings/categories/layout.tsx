import { CategoriesHeader } from './_components/categories-header'

const CategoriesLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6 max-w-[860px]">
    <CategoriesHeader />
    {children}
  </div>
)

export default CategoriesLayout
