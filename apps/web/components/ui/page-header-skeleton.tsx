type Props = {
  withAction?: boolean
  withSubtitle?: boolean
}

export const PageHeaderSkeleton = ({
  withAction = false,
  withSubtitle = false,
}: Props) => {
  const titleAndSubtitle = (
    <div className="flex flex-col gap-1">
      <span className="h-7 w-40 rounded bg-muted animate-pulse" />
      {withSubtitle && (
        <span className="h-3 w-64 rounded bg-muted/70 animate-pulse" />
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {withAction ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          {titleAndSubtitle}
          <span className="h-9 w-32 rounded-md bg-muted animate-pulse" />
        </div>
      ) : (
        titleAndSubtitle
      )}
    </div>
  )
}
