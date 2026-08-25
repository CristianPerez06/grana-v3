'use client'

import { useEffect, useState } from 'react'

/**
 * Fraction of the layout viewport the visual viewport has to shrink past for
 * the on-screen keyboard to be considered open.
 *
 * It is a ratio and not a pixel threshold on purpose: mobile browsers also
 * shrink the visual viewport when their own URL bar expands, and that overlay
 * is a small share of the screen (~10%) where a keyboard is a large one
 * (~35-50%). A pixel cutoff that clears a tall phone's URL bar would sit right
 * on top of a short phone's keyboard.
 */
const KEYBOARD_RATIO = 0.75

/**
 * True while the on-screen keyboard is covering part of the viewport.
 *
 * The web counterpart of native's `useKeyboardState`
 * (`react-native-keyboard-controller`), which `apps/mobile`'s `TabBar` uses to
 * step aside mid-edit. There is no equivalent API here, so this reads
 * `visualViewport`: when the keyboard opens the *visual* viewport shrinks while
 * the *layout* viewport (`window.innerHeight`) stays put, so the ratio between
 * them is the signal.
 *
 * Anything anchored to the bottom edge with `fixed` needs this. A fixed bar
 * positions against the layout viewport, so with the keyboard up it ends up
 * underneath it — or worse, wedged between the keyboard and the focused field,
 * eating the room that field needs.
 *
 * SSR-safe: `false` until mounted. Also `false`, permanently, where
 * `visualViewport` is missing — degrading to today's always-visible behavior
 * beats guessing from `resize` alone.
 */
export function useKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const layoutHeight = window.innerHeight
      if (layoutHeight <= 0) return
      setIsOpen(vv.height / layoutHeight < KEYBOARD_RATIO)
    }

    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  return isOpen
}
