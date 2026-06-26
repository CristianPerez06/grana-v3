import { useMemo, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react-native'
import {
  ACCOUNT_COLOR_KEYS,
  ACCOUNT_COLOR_HEX,
  type AccountColorKey,
} from '@grana/ui-contracts'
import type { Institution } from '@grana/accounts'
import { createCustomInstitution } from '../../lib/accounts/mutations'
import { useT } from '../../lib/locale-context'
import { accountColors, colors } from '../../lib/colors'

type Props = {
  institutions: Institution[]
  selectedId: string | null
  onSelect: (institution: Institution) => void
  invalid?: boolean
}

// Monogram chip for an institution: brand_color background + first letter.
function InstitutionChip({ institution, size = 24 }: { institution: Institution; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: institution.brand_color ?? colors.navy,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: size * 0.46 }}>
        {(institution.name[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  )
}

// Institution picker: searchable list + inline creation of a custom institution
// (name + color). Mirror of the web BankSelector. Catalog rows (user_id null) and
// the user's own rows are shown together; RLS already scopes the list.
export function BankSelector({ institutions, selectedId, onSelect, invalid }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const selected = institutions.find((i) => i.id === selectedId) ?? null

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className={`h-11 flex-row items-center justify-between rounded-lg border bg-card px-3 ${
          invalid ? 'border-error' : 'border-border'
        }`}
      >
        {selected ? (
          <View className="flex-row items-center gap-2">
            <InstitutionChip institution={selected} />
            <Text className="text-sm text-text" numberOfLines={1}>
              {selected.name}
            </Text>
          </View>
        ) : (
          <Text className="text-sm text-text-soft">{t('accounts.placeholders.institutionSearch')}</Text>
        )}
        <ChevronDown size={16} color={colors.textMuted} />
      </Pressable>

      <BankSelectorModal
        visible={open}
        onClose={() => setOpen(false)}
        institutions={institutions}
        selectedId={selectedId}
        onSelect={(inst) => {
          onSelect(inst)
          setOpen(false)
        }}
      />
    </>
  )
}

function BankSelectorModal({
  visible,
  onClose,
  institutions,
  selectedId,
  onSelect,
}: {
  visible: boolean
  onClose: () => void
  institutions: Institution[]
  selectedId: string | null
  onSelect: (institution: Institution) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return institutions
    return institutions.filter((i) => i.name.toLowerCase().includes(normalized))
  }, [institutions, query])

  const handleClose = () => {
    setQuery('')
    setCreating(false)
    onClose()
  }

  const handleCreated = (institution: Institution) => {
    setQuery('')
    setCreating(false)
    onSelect(institution)
  }

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      animationType="slide"
      presentationStyle="formSheet"
    >
      <KeyboardAvoidingView
        className="flex-1 bg-page"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
          <Text className="text-lg font-semibold text-text">{t('accounts.labels.institution')}</Text>
          <Pressable onPress={handleClose} accessibilityRole="button">
            <Text className="text-sm font-medium text-emerald">{t('common.close')}</Text>
          </Pressable>
        </View>

        {creating ? (
          <CustomInstitutionForm
            initialName={query.trim()}
            onCreated={handleCreated}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <>
            <View className="px-5 pt-4">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('accounts.placeholders.institutionSearch')}
                placeholderTextColor={colors.textSoft}
                autoCorrect={false}
                autoCapitalize="none"
                className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-text"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pt-2 pb-6"
              ListFooterComponent={
                <Pressable
                  onPress={() => setCreating(true)}
                  accessibilityRole="button"
                  className="mt-2 py-3"
                >
                  <Text className="text-sm font-semibold text-emerald-deep">
                    {query.trim()
                      ? t('accounts.customInstitution.add_with_query', { query: query.trim() })
                      : t('accounts.customInstitution.add')}
                  </Text>
                </Pressable>
              }
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId
                return (
                  <Pressable
                    onPress={() => onSelect(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    className="flex-row items-center gap-3 border-b border-border-soft py-3"
                  >
                    <InstitutionChip institution={item} size={28} />
                    <Text className="flex-1 text-sm text-text">{item.name}</Text>
                    {isSelected && (
                      <Text className="text-sm font-medium text-emerald">✓</Text>
                    )}
                  </Pressable>
                )
              }}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

function CustomInstitutionForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string
  onCreated: (institution: Institution) => void
  onCancel: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState<AccountColorKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setError(null)
    if (!name.trim()) {
      setError(t('accounts.customInstitution.errors.name_required'))
      return
    }
    if (!color) {
      setError(t('accounts.customInstitution.errors.color_required'))
      return
    }
    setSubmitting(true)
    const result = await createCustomInstitution(queryClient, {
      name: name.trim(),
      brand_color: ACCOUNT_COLOR_HEX[color],
      icon_type: 'wallet',
    })
    setSubmitting(false)
    if (result.ok) {
      onCreated(result.institution)
      return
    }
    setError(result.fieldErrors?.name ?? t(result.errorKey))
  }

  return (
    <View className="gap-4 px-5 pt-5">
      <Text className="text-base font-bold text-text">
        {t('accounts.customInstitution.title_inline')}
      </Text>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-text">
          {t('accounts.customInstitution.name_label')}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('accounts.customInstitution.name_placeholder')}
          placeholderTextColor={colors.textSoft}
          maxLength={50}
          autoFocus
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-text"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-text">
          {t('accounts.customInstitution.color_label')}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {ACCOUNT_COLOR_KEYS.map((key) => {
            const isSelected = color === key
            return (
              <Pressable
                key={key}
                onPress={() => setColor(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: accountColors[key],
                  borderWidth: isSelected ? 3 : 0,
                  borderColor: colors.navy,
                }}
              />
            )
          })}
        </View>
      </View>

      {error && <Text className="text-sm text-error">{error}</Text>}

      <View className="flex-row items-center gap-3 pt-2">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="rounded-xl bg-border-soft px-4 py-2.5"
        >
          <Text className="text-sm font-semibold text-text">
            {t('accounts.customInstitution.cancel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          className={`flex-1 items-center rounded-xl bg-emerald px-4 py-2.5 ${
            submitting ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-sm font-semibold text-white">
            {t('accounts.customInstitution.create')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
