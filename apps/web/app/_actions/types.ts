export type ActionResult<T> =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
      errorCode?: string
    }
