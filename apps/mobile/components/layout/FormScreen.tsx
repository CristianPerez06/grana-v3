import type { ReactNode } from 'react'
import { View } from 'react-native'
import type { PageHeaderProps } from '@grana/ui-contracts'
import { PageHeader } from '../ui/PageHeader'
import {
  KEYBOARD_BOTTOM_OFFSET,
  KeyboardAwareScrollView,
} from './keyboard-aware-scroll-view'

type Props = PageHeaderProps & {
  /** Overrides the back-link's navigation (e.g. `router.back()` over a fixed href). */
  onBackPress?: () => void
  /**
   * Overrides the scroll content container's spacing. Screens keep their own
   * rhythm — the paddings are deliberately NOT normalized here.
   */
  contentClassName?: string
  children: ReactNode
}

/**
 * Shell of every pushed form screen: `PageHeader` over a scroll body that keeps
 * the focused field above the keyboard. Replaces the
 * `View > PageHeader > ScrollView` triple that each form screen repeated, and
 * with it the per-screen keyboard handling that never existed (see spec
 * `mobile-app-shell`).
 *
 * It composes `PageHeader` and forwards `PageHeaderProps` untouched, so the
 * canonical page-title style keeps living in one place and the `page-header`
 * invariants still hold through the shell: the header is a sibling of the
 * scroller (never a child of its `contentContainer`), and the screen declares no
 * `SafeAreaView edges={['top']}` of its own — the header owns the top inset.
 *
 * Not for screens that need a non-scrolling body or a composed detail header
 * (`DashboardHeader`, `CardHero`, …); those keep composing the tree by hand.
 */
export function FormScreen({
  contentClassName = 'px-6 py-6 pb-28',
  children,
  ...headerProps
}: Props) {
  return (
    <View className="flex-1 bg-page">
      <PageHeader {...headerProps} />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_BOTTOM_OFFSET}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={contentClassName}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  )
}
