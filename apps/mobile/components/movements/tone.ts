import type { Tone } from '@grana/transactions'

// Mobile mirror of web's `toneToClass`: map the shared editorial `Tone` to a
// structural NativeWind text-color class. Same matrix as web (income→positive,
// expense→negative, neutral→text, pending→text-muted); each platform maps the
// pure `Tone` to its own style system.
const TONE_CLASS: Record<Tone, string> = {
  income: 'text-positive',
  expense: 'text-negative',
  neutral: 'text-text',
  pending: 'text-text-muted',
}

/** NativeWind text-color class for the amount in the given tone. */
export const toneToClass = (tone: Tone): string => TONE_CLASS[tone]
