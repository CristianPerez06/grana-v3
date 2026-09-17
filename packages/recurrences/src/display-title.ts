/**
 * HOW A RULE — OR ONE OF ITS OCURRENCIAS — IS NAMED ON SCREEN.
 *
 * The order, once, for every surface of both apps:
 *
 *   descripción → subcategoría → categoría → etiqueta del tipo
 *
 * **The description first, always.** It is the only part the user wrote about
 * this rule in particular, and nothing the app derives beats it.
 *
 * **Then the subcategoría, before the categoría.** A rule with no description is
 * named by its classification, and the narrower half is the one that tells two
 * rules apart: "Internet" and "Gas" say what they are, while both of them read
 * "Servicios" — three service rules under the same name are three rows the user
 * has to open to identify. The categoría stays as the step after it, because a
 * rule can be classified only that far.
 *
 * **The type label last** ("Gasto", "Ingreso", "Transferencia"). It identifies
 * nothing, and that is the point: it is never empty, so a row always has a name.
 *
 * WHY IT LIVES HERE. The same rule is named on nine surfaces across the two
 * apps, and the order is exactly what diverged: the dashboard's "Compromisos"
 * already read subcategoría → categoría while every recurrence screen stopped at
 * the categoría, so one rule answered to two names depending on which screen you
 * were looking at. Retyping the chain a tenth time is how that happens again.
 *
 * It takes the names ALREADY RESOLVED, not the rows: a system category is named
 * through the translator (`categories.{canonical_name}`) and each app holds its
 * own. What must be decided once is the ORDER, and that is what is here.
 */
export type RecurrenceTitleParts = {
  /** What the user typed. `null` on a rule that was never given one. */
  description?: string | null
  /** The subcategoría's display name, already translated. */
  subcategory?: string | null
  /** The categoría's display name, already translated. */
  category?: string | null
  /** "Gasto" / "Ingreso" / "Transferencia" — the last resort that never fails. */
  type?: string | null
}

/**
 * The first of the four that says something, or `null` when none does.
 *
 * Blank is the same as absent: a description of `"   "` is not a name, and the
 * column holds one wherever a form submitted whitespace. Callers that must paint
 * something add their own last resort — the notice says "esta recurrencia".
 */
export function recurrenceTitle(parts: RecurrenceTitleParts): string | null {
  for (const candidate of [parts.description, parts.subcategory, parts.category, parts.type]) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return null
}
