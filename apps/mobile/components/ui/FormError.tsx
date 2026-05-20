import { Text } from 'react-native'

type Props = {
  message: string | null
}

export function FormError({ message }: Props) {
  if (!message) return null
  return <Text className="mt-2 text-sm text-error">{message}</Text>
}
