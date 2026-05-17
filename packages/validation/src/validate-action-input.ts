import { ValidationError, type Schema } from 'yup'

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Partial<Record<keyof T, string>> }

export const validateActionInput = async <T>(
  schema: Schema<T>,
  input: unknown,
): Promise<ValidationResult<T>> => {
  try {
    const data = await schema.validate(input, {
      abortEarly: false,
      stripUnknown: true,
    })
    return { ok: true, data }
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    const fieldErrors: Partial<Record<keyof T, string>> = {}
    for (const inner of error.inner) {
      if (!inner.path) continue
      const key = inner.path as keyof T
      if (!fieldErrors[key]) fieldErrors[key] = inner.message
    }
    return { ok: false, fieldErrors }
  }
}
