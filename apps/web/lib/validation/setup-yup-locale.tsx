'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'

export const ValidationLocaleSetter = () => {
  const t = useTranslations('validation')

  useEffect(() => {
    yup.setLocale({
      mixed: {
        required: ({ label }) => t('required', { field: String(label ?? '') }),
        notType: ({ label, type }) =>
          t('notType', { field: String(label ?? ''), type: String(type ?? '') }),
      },
      string: {
        email: ({ label }) => t('email', { field: String(label ?? '') }),
        min: ({ label, min }) =>
          t('min', { field: String(label ?? ''), min: Number(min) }),
        max: ({ label, max }) =>
          t('max', { field: String(label ?? ''), max: Number(max) }),
      },
    })
  }, [t])

  return null
}
