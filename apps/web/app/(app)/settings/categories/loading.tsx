const CategorySectionSkeleton = ({ rowCount }: { rowCount: number }) => (
  <section className="flex flex-col gap-3">
    <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="h-3.5 w-32 rounded bg-muted animate-pulse" />
              <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
            </div>
          </div>
          <span className="h-4 w-4 shrink-0 rounded bg-muted/70 animate-pulse" />
        </div>
      ))}
    </div>
  </section>
)

const CategoriesLoading = () => (
  <div className="flex flex-col gap-8" aria-busy="true">
    <CategorySectionSkeleton rowCount={4} />
    <CategorySectionSkeleton rowCount={2} />
  </div>
)

export default CategoriesLoading
