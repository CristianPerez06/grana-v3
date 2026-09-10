import { createContext, useContext } from 'react'
import type { Edge } from 'react-native-safe-area-context'

/**
 * Whether something above the header already took the top inset.
 *
 * The mobile design has one rule about the top of the screen: the navy block
 * runs from the device edge — status bar, notch, Dynamic Island — down through
 * the header, with no discontinuity of color (spec `page-header`). `PageHeader`
 * gets that by wrapping itself in `SafeAreaView edges={['top']}`, which is why
 * screens are told never to add one of their own.
 *
 * The global materialization notice broke that assumption: it renders ABOVE
 * every screen, so IT is the top-most thing, not the header. With both applying
 * the inset the result was a tall EMPTY navy band under a notice that looked
 * like it had fallen off the top of the app.
 *
 * `SafeAreaView` is a native view: it does NOT read `SafeAreaInsetsContext`, so
 * shrinking the insets from JS would not have moved it. What it does read is its
 * `edges` prop — hence this context. Whoever paints the inset says so here, and
 * the headers below stop clearing what is already cleared.
 */
const TopInsetTakenContext = createContext(false)

export const TopInsetTakenProvider = TopInsetTakenContext.Provider

// Module-level so the prop keeps its identity between renders: a fresh array
// each time would re-send `edges` across the bridge for nothing.
const CLEARS_TOP: Edge[] = ['top']
const CLEARS_NOTHING: Edge[] = []

/**
 * The edges a navy header has to clear itself: `['top']` when it is the
 * top-most thing on screen, none when a notice above it already painted the
 * inset.
 */
export function useHeaderEdges(): Edge[] {
  return useContext(TopInsetTakenContext) ? CLEARS_NOTHING : CLEARS_TOP
}
