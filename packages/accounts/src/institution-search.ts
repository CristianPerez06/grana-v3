/**
 * Diacritic-insensitive filtering for the institution pickers.
 *
 * The pickers used to filter with a plain `name.toLowerCase().includes(query)`,
 * which made a catalog row look missing the moment the user typed: "uala" does
 * not contain-match "Ualá", nor "nacion" "Nación". The row was in the database
 * and in the unfiltered list, but typing its name hid it — and the picker then
 * offered "+ Agregar institución", so the natural next step was a duplicate
 * custom row.
 *
 * Folding is applied to BOTH sides, so an accented query still matches an
 * accented name. Same NFD idiom as `slugify` in both apps.
 */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Filters institutions by name, ignoring case and accents. An empty or
 * whitespace-only query returns the list untouched (same identity, so callers
 * memoizing on it do not re-render).
 */
export const filterInstitutions = <T extends { name: string }>(
  institutions: T[],
  query: string,
): T[] => {
  const needle = fold(query.trim())
  if (!needle) return institutions
  return institutions.filter((institution) => fold(institution.name).includes(needle))
}
