// ── Detección de reglas recurrentes casi idénticas (pura) ─────────────────────
//
// Nada impedía crear dos veces la misma recurrencia, y el hub dibuja una fila por
// cada una: el usuario ve todo duplicado sin entender por qué. Este helper
// detecta la colisión para AVISAR, nunca para bloquear.
//
// La clave es `(account_id, currency_code, movement_type)` más un monto IGUAL O
// CASI IGUAL: hasta `DUPLICATE_AMOUNT_TOLERANCE` (1 %) de diferencia relativa.
// Deja fuera categoría y descripción a propósito: en los duplicados reales
// observados esos campos difieren (una regla quedó en `impuestos` y su gemela en
// `impuestos / IIBB`; una tenía descripción y la otra no), así que exigir
// igualdad ahí los dejaría pasar justo cuando importa.
//
// El monto tampoco puede exigirse exacto. El caso real de la auditoría del 5/9:
// dos reglas del mismo préstamo, 48.733,92 y 48.723,04, una con título y otra
// sin. Una cuota recalculada, un redondeo o un tipeo dejan dos montos distintos
// por centavos que son la misma obligación; la igualdad exacta las dejaba pasar.
//
// La contracara es que la clave produce falsos positivos legítimos: dos
// suscripciones de USD 20 en la misma tarjeta ("chat gpt" y "claude") colisionan
// sin ser duplicados. Por eso el aviso NO bloquea y siempre muestra el título de
// la regla existente: el usuario distingue en un vistazo lo que la clave no
// puede. Un aviso bloqueante con esta clave sería un bug.

/** Diferencia relativa máxima entre dos montos para considerarlos "casi iguales". */
export const DUPLICATE_AMOUNT_TOLERANCE = 0.01

export type DuplicateCandidate = {
  account_id: string | null
  currency_code: string
  movement_type: string
  amount: number | string
}

export type ExistingRuleForDuplicateCheck = DuplicateCandidate & {
  id: string
  status: string
  description: string | null
  next_occurrence?: string | null
}

export type DuplicateMatch = {
  id: string
  description: string | null
  next_occurrence: string | null
}

// Los montos viajan como number (form) o string (numeric de Postgres). Se
// comparan normalizados a centavos para que 450000 y "450000.00" sean iguales.
const toCents = (v: number | string): number => Math.round(Number(v) * 100)

/**
 * Dos montos son "casi iguales" cuando coinciden al centavo o difieren en no más
 * del 1 % del mayor de los dos. Inclusivo en el borde: 1 % exacto colisiona.
 */
export function closeAmounts(a: number | string, b: number | string): boolean {
  const ca = toCents(a)
  const cb = toCents(b)
  if (!Number.isFinite(ca) || !Number.isFinite(cb)) return false
  if (ca === cb) return true
  const larger = Math.max(Math.abs(ca), Math.abs(cb))
  return Math.abs(ca - cb) <= larger * DUPLICATE_AMOUNT_TOLERANCE
}

const sameBucket = (a: DuplicateCandidate, b: DuplicateCandidate): boolean =>
  a.account_id === b.account_id &&
  a.currency_code === b.currency_code &&
  a.movement_type === b.movement_type

const toMatch = (rule: ExistingRuleForDuplicateCheck): DuplicateMatch => ({
  id: rule.id,
  description: rule.description,
  next_occurrence: rule.next_occurrence ?? null,
})

/**
 * Reglas activas que colisionan con la candidata bajo la clave de duplicado.
 * `excludeId` permite ignorar la propia regla al editar. Devuelve [] cuando no
 * hay colisión — el caller decide si mostrar el aviso, nunca si permitir.
 */
export function findDuplicateRules(
  candidate: DuplicateCandidate,
  existing: ExistingRuleForDuplicateCheck[],
  options: { excludeId?: string } = {},
): DuplicateMatch[] {
  return existing
    .filter(
      (rule) =>
        rule.status === 'active' &&
        rule.id !== options.excludeId &&
        sameBucket(rule, candidate) &&
        closeAmounts(rule.amount, candidate.amount),
    )
    .map(toMatch)
}

/**
 * Agrupa las reglas activas que colisionan entre sí, para que el hub las señale.
 * Solo devuelve los grupos de 2 o más: un grupo de 1 no es una colisión.
 *
 * Dentro de cada `(cuenta, moneda, tipo)` las reglas se ordenan por monto y se
 * encadenan: una regla entra al grupo de la anterior si su monto está dentro de
 * la tolerancia respecto de ella. Es lo mismo que hace `findDuplicateRules` al
 * crear, visto desde el listado.
 */
export function groupDuplicateRules(
  rules: ExistingRuleForDuplicateCheck[],
): DuplicateMatch[][] {
  const byBucket = new Map<string, ExistingRuleForDuplicateCheck[]>()

  for (const rule of rules) {
    if (rule.status !== 'active') continue
    const key = [rule.account_id ?? 'none', rule.currency_code, rule.movement_type].join('|')
    const bucket = byBucket.get(key)
    if (bucket) bucket.push(rule)
    else byBucket.set(key, [rule])
  }

  const groups: DuplicateMatch[][] = []
  for (const bucket of byBucket.values()) {
    const sorted = [...bucket].sort((a, b) => toCents(a.amount) - toCents(b.amount))
    let current: ExistingRuleForDuplicateCheck[] = []
    for (const rule of sorted) {
      const prev = current[current.length - 1]
      if (prev && closeAmounts(prev.amount, rule.amount)) {
        current.push(rule)
      } else {
        if (current.length > 1) groups.push(current.map(toMatch))
        current = [rule]
      }
    }
    if (current.length > 1) groups.push(current.map(toMatch))
  }

  return groups
}

/** Ids de todas las reglas que participan de alguna colisión — para marcar filas. */
export function duplicateRuleIds(rules: ExistingRuleForDuplicateCheck[]): Set<string> {
  return new Set(groupDuplicateRules(rules).flat().map((rule) => rule.id))
}
