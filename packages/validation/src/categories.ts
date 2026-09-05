import * as yup from 'yup'

export const createCategorySchema = yup
  .object({
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .required()
      .min(1)
      .max(60),
    type: yup
      .string()
      .label('type')
      .required()
      .oneOf(['income', 'expense', 'both'] as const),
    icon: yup.string().label('icon').nullable().optional(),
    color: yup
      .string()
      .label('color')
      .nullable()
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/, 'color'),
    // Who owns it: the user (`own`, default) or the user's household
    // (`household`). The mutation resolves the household id and rejects
    // `household` when the caller has no active household.
    scope: yup.string().label('scope').oneOf(['own', 'household'] as const).optional(),
  })
  .strict()

export const updateCategorySchema = yup
  .object({
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(1)
      .max(60)
      .optional(),
    icon: yup.string().label('icon').nullable().optional(),
    color: yup
      .string()
      .label('color')
      .nullable()
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/, 'color'),
    // `household` moves an own category to the household. `own` on a household
    // category is ignored: the way back is not offered (other members may
    // already point movements at it).
    scope: yup.string().label('scope').oneOf(['own', 'household'] as const).optional(),
  })
  .strict()

export const createSubcategorySchema = yup
  .object({
    category_id: yup.string().label('category_id').required().uuid(),
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .required()
      .min(1)
      .max(60),
  })
  .strict()

export const updateSubcategorySchema = yup
  .object({
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(1)
      .max(60)
      .optional(),
  })
  .strict()

export type CreateCategoryInput = yup.InferType<typeof createCategorySchema>
export type UpdateCategoryInput = yup.InferType<typeof updateCategorySchema>
export type CreateSubcategoryInput = yup.InferType<typeof createSubcategorySchema>
export type UpdateSubcategoryInput = yup.InferType<typeof updateSubcategorySchema>
