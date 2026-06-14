'use client'

import { useEffect, useState } from 'react'
import { getGuidanceStatus, markGuidance } from '@/app/_actions/guidance'
import type { GuidanceId } from './catalog'

type GuidanceState = {
  seen_at: string | null
  dismissed_at: string | null
  completed_at: string | null
  isVisible: boolean
  loading: boolean
  mark: (status: 'seen' | 'dismissed' | 'completed') => Promise<void>
}

/**
 * Hook para consultar y marcar el estado de un guidance
 *
 * isVisible es true si:
 * - No existe en DB (null) → mostrar
 * - Existe pero dismissed_at y completed_at son NULL → mostrar
 *
 * isVisible es false si:
 * - dismissed_at IS NOT NULL → usuario lo cerró
 * - completed_at IS NOT NULL → acción completada
 */
export function useGuidance(guidanceId: GuidanceId): GuidanceState {
  const [state, setState] = useState<GuidanceState>({
    seen_at: null,
    dismissed_at: null,
    completed_at: null,
    isVisible: true, // Asumir visible hasta que se cargue
    loading: true,
    mark: async () => {},
  })

  useEffect(() => {
    const loadGuidance = async () => {
      try {
        const guidance = await getGuidanceStatus(guidanceId)

        if (guidance === null) {
          // Nunca se vio este guidance
          setState((prev) => ({
            ...prev,
            isVisible: true,
            loading: false,
          }))
        } else {
          // Calcular isVisible basado en dismissed_at y completed_at
          const isVisible =
            guidance.dismissed_at === null && guidance.completed_at === null

          setState((prev) => ({
            ...prev,
            seen_at: guidance.seen_at,
            dismissed_at: guidance.dismissed_at,
            completed_at: guidance.completed_at,
            isVisible,
            loading: false,
          }))
        }
      } catch (error) {
        console.error('Failed to load guidance:', error)
        setState((prev) => ({
          ...prev,
          loading: false,
        }))
      }
    }

    loadGuidance()
  }, [guidanceId])

  const mark = async (status: 'seen' | 'dismissed' | 'completed') => {
    try {
      await markGuidance(guidanceId, status)

      // Actualizar estado local
      const now = new Date().toISOString()
      setState((prev) => {
        const updated = { ...prev }
        if (status === 'seen') {
          updated.seen_at = updated.seen_at || now
        } else if (status === 'dismissed') {
          updated.dismissed_at = now
        } else if (status === 'completed') {
          updated.completed_at = now
        }
        // Recalcular isVisible
        updated.isVisible =
          updated.dismissed_at === null && updated.completed_at === null
        return updated
      })
    } catch (error) {
      console.error('Failed to mark guidance:', error)
    }
  }

  return {
    ...state,
    mark,
  }
}
