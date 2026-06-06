const FieldSkeleton = () => (
  <div className="flex flex-col gap-1.5">
    <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
    <span className="h-10 w-full rounded-lg bg-muted animate-pulse" />
  </div>
)

const NewCategoryLoading = () => (
  <div className="flex max-w-md flex-col gap-4" aria-busy="true">
    {Array.from({ length: 4 }).map((_, i) => (
      <FieldSkeleton key={i} />
    ))}
    <span className="h-10 w-32 self-end rounded-lg bg-muted animate-pulse" />
  </div>
)

export default NewCategoryLoading
