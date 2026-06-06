const SubcategoryRowSkeleton = () => (
  <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3 last:border-b-0">
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
      <span className="h-3.5 w-32 rounded bg-muted animate-pulse" />
    </div>
    <span className="h-4 w-4 shrink-0 rounded bg-muted/70 animate-pulse" />
  </div>
)

const SubcategoriesLoading = () => (
  <div className="flex flex-col rounded-lg border border-border" aria-busy="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <SubcategoryRowSkeleton key={i} />
    ))}
  </div>
)

export default SubcategoriesLoading
