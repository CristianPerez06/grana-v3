import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Tile, TileHead, DetailRow } from './glance'

// Tile "Detalle": filas clave/valor genéricas. El orquestador arma las filas
// según el kind (fecha, total, origen, estado, etc.).

export type DetailRowSpec = {
  key: string
  icon: ReactNode
  label: ReactNode
  value: ReactNode
  rightLabel?: ReactNode
  rightValue?: ReactNode
}

export const TileDetail = ({ rows, span2 }: { rows: DetailRowSpec[]; span2?: boolean }) => {
  const t = useTranslations('transactions.detail')
  if (!rows.length) return null

  return (
    <Tile span2={span2}>
      <TileHead eyebrow={t('groups.details')} />
      {rows.map((r, i) => (
        <DetailRow
          key={r.key}
          first={i === 0}
          icon={r.icon}
          label={r.label}
          value={r.value}
          rightLabel={r.rightLabel}
          rightValue={r.rightValue}
        />
      ))}
    </Tile>
  )
}
