'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PURPOSE_ICONS, type Purpose } from '@grana/savings'
import { Button } from '@/components/ui/button'
import { createPurpose, renamePurpose } from '@/app/_actions/savings'
import { DrawerBackHeader } from './drawer-back-header'

/**
 * Alta y edición de un propósito. Un nombre y un ícono, y nada más.
 *
 * No hay monto objetivo ni fecha, y no es una omisión: eso es una META y llega
 * en la fase 4, cuando existan las posiciones que la respalden. Una barra de
 * progreso que no sabe en qué moneda está parada la plata mide el número
 * nominal, que en Argentina es justo lo que no hay que enseñar.
 *
 * Tampoco hay campo de descripción. "Viaje" + "Japón" se probó en el papel y
 * cae por dos lados: dos viajes serían dos propósitos llamados igual —contra el
 * índice único— y "Viaje · Japón" no entra en las filas donde el nombre se
 * muestra. El prefill da el mismo ahorro de tipeo con un campo.
 */
export function PurposeForm({
  purpose,
  initialName,
  initialIcon,
  onDone,
  onBack,
}: {
  /** Presente = edición. Ausente = alta. */
  purpose?: Purpose | null
  /** Precarga del alta cuando se llegó tocando una sugerencia. */
  initialName?: string
  initialIcon?: string
  onDone: (purposeId: string) => void | Promise<void>
  onBack: () => void
}) {
  const t = useTranslations('savings')
  const [name, setName] = useState(purpose?.name ?? initialName ?? '')
  const [icon, setIcon] = useState<string | null>(purpose?.icon ?? initialIcon ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const input = { name, icon }
      const result = purpose
        ? await renamePurpose(purpose.id, input)
        : await createPurpose(input)

      if (!result.ok) {
        setError(result.formError ?? t('purposes.errors.generic'))
        return
      }
      await onDone(result.id ?? purpose?.id ?? '')
    })
  }

  return (
    <div className="flex flex-col">
      <DrawerBackHeader
        title={purpose ? t('purposes.edit') : t('purposes.new')}
        onBack={onBack}
      />

      <label
        htmlFor="purpose-name"
        className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft"
      >
        {t('purposes.name_label')}
      </label>
      <input
        id="purpose-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
        className="mt-2 h-12 rounded-xl border border-border bg-card px-3.5 text-[15px] font-semibold text-text outline-none transition-colors focus:border-[#C9CFD7] focus:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]"
      />

      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
        {t('purposes.icon_label')}
      </p>
      {/* El ícono no es decoración: en una lista plana es lo que hace que ✈️
          Japón y ✈️ Bariloche se lean como familia, que es el trabajo que en
          otro modelo haría una jerarquía de dos niveles. */}
      <div className="mt-2 flex flex-wrap gap-2">
        {PURPOSE_ICONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setIcon(option === icon ? null : option)}
            aria-pressed={option === icon}
            className={`flex size-11 items-center justify-center rounded-xl border text-[18px] transition-colors ${
              option === icon
                ? 'border-emerald-deep bg-emerald-deep/5'
                : 'border-border-soft bg-card hover:bg-surface-sunken'
            }`}
          >
            <span aria-hidden>{option}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-[13px] font-semibold text-negative">{error}</p>}

      <Button
        className="mt-6 h-11"
        onClick={submit}
        disabled={pending || name.trim().length === 0}
      >
        {/* El CTA dice la ACCIÓN, no repite el título de la pantalla. Un
            encabezado "Nuevo propósito" con un botón "Nuevo propósito" abajo es
            la misma palabra dos veces sin agregar nada — el mismo defecto que ya
            se corrigió en el formulario de guardar. */}
        {purpose ? t('purposes.update_cta') : t('purposes.create_cta')}
      </Button>
    </div>
  )
}
