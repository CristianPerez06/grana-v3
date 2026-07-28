import { useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native'
import { BottomSheet } from './BottomSheet'

// Cap the results list so the sheet leaves room for the keyboard when searching.
const LIST_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.45)

type Institution = { id: string; name: string }

type Props = {
  visible: boolean
  onClose: () => void
  institutions: Institution[]
  onSelect: (institution: Institution) => void
  selectedId?: string | null
  title?: string
  searchPlaceholder?: string
  closeLabel?: string
}

export function InstitutionPickerModal({
  visible,
  onClose,
  institutions,
  onSelect,
  selectedId,
  title = 'Banco',
  searchPlaceholder = 'Buscar banco o billetera…',
  closeLabel = 'Cerrar',
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return institutions
    return institutions.filter((i) => i.name.toLowerCase().includes(normalized))
  }, [institutions, query])

  const handleSelect = (institution: Institution) => {
    onSelect(institution)
    setQuery('')
    onClose()
  }

  const handleClose = () => {
    setQuery('')
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} ariaLabel={title}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between border-b border-border px-5 pb-3 pt-1">
          <Text className="text-lg font-semibold text-text">{title}</Text>
          <Pressable onPress={handleClose} accessibilityRole="button">
            <Text className="text-sm font-medium text-emerald">{closeLabel}</Text>
          </Pressable>
        </View>

        <View className="px-5 pt-4">
          <RNTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor="#8A94A3"
            autoCorrect={false}
            autoCapitalize="none"
            className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-text"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-2 pt-2"
          style={{ maxHeight: LIST_MAX_HEIGHT }}
          ListEmptyComponent={
            <Text className="px-1 pt-4 text-sm text-text-muted">
              Sin resultados.
            </Text>
          }
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId
            return (
              <Pressable
                onPress={() => handleSelect(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`flex-row items-center justify-between border-b border-border-soft py-3 ${
                  isSelected ? 'bg-emerald-bg' : ''
                }`}
              >
                <Text className="text-sm text-text">{item.name}</Text>
                {isSelected ? (
                  <Text className="text-sm font-medium text-emerald">✓</Text>
                ) : null}
              </Pressable>
            )
          }}
        />
      </KeyboardAvoidingView>
    </BottomSheet>
  )
}
