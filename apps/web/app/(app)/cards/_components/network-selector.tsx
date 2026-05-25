'use client'

import { useTranslations } from 'next-intl'

type Network = {
  id: string
  slug: string
  name: string
  brand_color: string | null
}

type NetworkSelection =
  | { type: 'catalog'; networkId: string }
  | { type: 'other'; name: string }
  | null

type Props = {
  networks: Network[]
  value: NetworkSelection
  onChange: (value: NetworkSelection) => void
  error?: string
}

export const NetworkSelector = ({ networks, value, onChange, error }: Props) => {
  const t = useTranslations('cards')
  const selectedCatalogId = value?.type === 'catalog' ? value.networkId : null
  const isOther = value?.type === 'other'
  const otherName = value?.type === 'other' ? value.name : ''

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {networks.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onChange({ type: 'catalog', networkId: n.id })}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              selectedCatalogId === n.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted',
            ].join(' ')}
            style={
              n.brand_color && selectedCatalogId === n.id
                ? { borderColor: n.brand_color, backgroundColor: n.brand_color, color: '#fff' }
                : {}
            }
          >
            {n.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ type: 'other', name: '' })}
          className={[
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            isOther
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground hover:bg-muted',
          ].join(' ')}
        >
          {t('actions.network_other')}
        </button>
      </div>

      {isOther && (
        <input
          type="text"
          value={otherName}
          onChange={(e) => onChange({ type: 'other', name: e.target.value })}
          placeholder={t('placeholders.network_other')}
          maxLength={50}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
