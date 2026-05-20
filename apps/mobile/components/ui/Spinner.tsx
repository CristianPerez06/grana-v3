import { ActivityIndicator } from 'react-native'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const sizeMap = { sm: 'small', md: 'small', lg: 'large' } as const

export function Spinner({ size = 'md', color = '#10B981' }: Props) {
  return <ActivityIndicator size={sizeMap[size]} color={color} />
}
