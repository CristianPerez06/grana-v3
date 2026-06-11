const SubcategoryRowSkeleton = () => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border-soft px-[18px] py-[15px] first:border-t-0">
    <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
    <span className="h-9 w-9 shrink-0 rounded-[12px] bg-muted/70 animate-pulse" />
  </div>
)

const SubcategoriesLoading = () => (
  <div className="overflow-hidden rounded-[18px] border border-border bg-card" aria-busy="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <SubcategoryRowSkeleton key={i} />
    ))}
  </div>
)

export default SubcategoriesLoading
