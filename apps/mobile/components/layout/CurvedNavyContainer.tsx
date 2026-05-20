import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native'
import { CurvedNavyHeader } from './CurvedNavyHeader'

type Props = {
  title: string
  subtitle?: string
  showBack?: boolean
  backHref?: string
  backLabel?: string
  children: ReactNode
}

export function CurvedNavyContainer({
  title,
  subtitle,
  showBack,
  backHref,
  backLabel,
  children,
}: Props) {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-page"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow"
      >
        <CurvedNavyHeader
          title={title}
          subtitle={subtitle}
          showBack={showBack}
          backHref={backHref}
          backLabel={backLabel}
        />
        <View className="mx-auto w-full max-w-[430px] px-5 pt-8 pb-10">
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
