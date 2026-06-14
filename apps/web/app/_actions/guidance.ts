'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidGuidanceId } from '@/lib/guidance/catalog'

export type GuidanceStatus = {
  seen_at: string | null
  dismissed_at: string | null
  completed_at: string | null
}

/**
 * Obtener estado de un guidance para el usuario actual
 */
export async function getGuidanceStatus(guidanceId: unknown): Promise<GuidanceStatus | null> {
  if (!isValidGuidanceId(guidanceId)) {
    throw new Error(`Invalid guidance ID: ${guidanceId}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('user_guidance_events')
    .select('seen_at, dismissed_at, completed_at')
    .eq('user_id', user.id)
    .eq('guidance_id', guidanceId)
    .maybeSingle()

  if (error) {
    console.error('Failed to get guidance status:', error)
    return null
  }

  return data ?? null
}

/**
 * Marcar un guidance con una acción (seen, dismissed, completed)
 */
export async function markGuidance(
  guidanceId: unknown,
  status: 'seen' | 'dismissed' | 'completed',
): Promise<boolean> {
  if (!isValidGuidanceId(guidanceId)) {
    throw new Error(`Invalid guidance ID: ${guidanceId}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const now = new Date().toISOString()
  const updateData: Record<string, string | null> = {
    updated_at: now,
  }

  // Permitir marcar múltiples veces (idempotente)
  if (status === 'seen') {
    updateData.seen_at = updateData.seen_at || now
  } else if (status === 'dismissed') {
    updateData.dismissed_at = now
  } else if (status === 'completed') {
    updateData.completed_at = now
  }

  // UPSERT: si no existe, crea; si existe, actualiza
  const { error } = await supabase
    .from('user_guidance_events')
    .upsert(
      {
        user_id: user.id,
        guidance_id: guidanceId,
        ...updateData,
      },
      {
        onConflict: 'user_id, guidance_id',
      },
    )

  if (error) {
    console.error('Failed to mark guidance:', error)
    return false
  }

  return true
}
