// ── Detección de reglas recurrentes casi idénticas (pura) ─────────────────────
//
// Nada impedía crear dos veces la misma recurrencia, y el hub dibuja una fila por
// cada una: el usuario ve todo duplicado sin entender por qué. Este helper
// detecta la colisión para AVISAR, nunca para bloquear.
//
// La clave es `(account_id, currency_code, movement_type, amount)` y deja fuera
// categoría y descripción a propósito: en los duplicados reales observados esos
// campos difieren (una regla quedó en `impuestos` y su gemela en
// `impuestos / IIBB`; una tenía descripción y la otra no), así que exigir
// igualdad ahí los dejaría pasar justo cuando importa.
//
// La contracara es que la clave produce falsos positivos legítimos: dos
// suscripciones de USD 20 en la misma tarjeta ("chat gpt" y "claude") colisionan
// sin ser duplicados. Por eso el aviso NO bloquea y siempre muestra el título de
// la regla existente: el usuario distingue en un vistazo lo que la clave no
// puede. Un aviso bloqueante con esta clave sería un bug.

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
function sameAmount(a: number | string, b: number | string): boolean {
  const na = Math.round(Number(a) * 100)
  const nb = Math.round(Number(b) * 100)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

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
        rule.account_id === candidate.account_id &&
        rule.currency_code === candidate.currency_code &&
        rule.movement_type === candidate.movement_type &&
        sameAmount(rule.amount, candidate.amount),
    )
    .map((rule) => ({
      id: rule.id,
      description: rule.description,
      next_occurrence: rule.next_occurrence ?? null,
    }))
}

/**
 * Agrupa las reglas activas que colisionan entre sí, para que el hub las señale.
 * Solo devuelve los grupos de 2 o más: un grupo de 1 no es una colisión.
 */
export function groupDuplicateRules(
  rules: ExistingRuleForDuplicateCheck[],
): DuplicateMatch[][] {
  const byKey = new Map<string, ExistingRuleForDuplicateCheck[]>()

  for (const rule of rules) {
    if (rule.status !== 'active') continue
    const key = [
      rule.account_id ?? 'none',
      rule.currency_code,
      rule.movement_type,
      Math.round(Number(rule.amount) * 100),
    ].join('|')
    const bucket = byKey.get(key)
    if (bucket) bucket.push(rule)
    else byKey.set(key, [rule])
  }

  return [...byKey.values()]
    .filter((bucket) => bucket.length > 1)
    .map((bucket) =>
      bucket.map((rule) => ({
        id: rule.id,
        description: rule.description,
        next_occurrence: rule.next_occurrence ?? null,
      })),
    )
}

/** Ids de todas las reglas que participan de alguna colisión — para marcar filas. */
export function duplicateRuleIds(rules: ExistingRuleForDuplicateCheck[]): Set<string> {
  return new Set(groupDuplicateRules(rules).flat().map((rule) => rule.id))
}
