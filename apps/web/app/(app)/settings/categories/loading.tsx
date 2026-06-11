const CategorySectionSkeleton = ({ rowCount }: { rowCount: number }) => (
  <section className="flex flex-col gap-2.5">
    <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    <div className="overflow-hidden rounded-[18px] border border-border bg-card">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 border-t border-border-soft px-[18px] py-[15px] first:border-t-0"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="size-[42px] shrink-0 rounded-[14px] bg-muted animate-pulse" />
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="h-3.5 w-32 rounded bg-muted animate-pulse" />
              <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
            </div>
          </div>
          <span className="h-9 w-9 shrink-0 rounded-[12px] bg-muted/70 animate-pulse" />
        </div>
      ))}
    </div>
  </section>
)

const CategoriesLoading = () => (
  <div className="flex flex-col gap-[26px]" aria-busy="true">
    <CategorySectionSkeleton rowCount={4} />
    <CategorySectionSkeleton rowCount={2} />
  </div>
)

export default CategoriesLoading
