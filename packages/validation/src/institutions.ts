import * as yup from 'yup'
import { ACCOUNT_COLOR_HEX_VALUES, INSTITUTION_ICON_TYPES } from '@grana/ui-contracts'

export const createCustomInstitutionSchema = yup
  .object({
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .required()
      .min(1)
      .max(50),
    brand_color: yup
      .string()
      .label('brand_color')
      .required()
      .oneOf(ACCOUNT_COLOR_HEX_VALUES),
    icon_type: yup
      .string()
      .label('icon_type')
      .required()
      .oneOf([...INSTITUTION_ICON_TYPES]),
  })
  .strict()

export type CreateCustomInstitutionInput = yup.InferType<typeof createCustomInstitutionSchema>
