import type { PGlite } from '@electric-sql/pglite'
import type { GranaSupabaseClient } from '@grana/supabase'

/**
 * The slice of PostgREST the generator actually uses, over PGlite.
 *
 * The point is to run `generateDueRecurrenceInstances` against a REAL Postgres
 * with the real constraints — above all
 * `recurrence_instances_one_pending_per_rule`, still alive until the activation
 * migration. A hand-written fake client can only reproduce the rejection we
 * imagined; the index reproduces the one that happens, including that a batch
 * insert is ONE statement and the first violation rejects every row in it.
 *
 * Deliberately partial: `select` with `eq` / `in` / `not(col,'is',null)`, and
 * `insert`. Anything else throws instead of silently returning nothing, so a
 * generator that grows a new call cannot pass by accident.
 */

type Filter = { sql: string; params: unknown[] }

type QueryError = { message: string; code?: string; details?: string }

class Query implements PromiseLike<{ data: unknown[] | null; error: QueryError | null }> {
  private filters: Filter[] = []

  constructor(
    private readonly db: PGlite,
    private readonly table: string,
    private readonly columns: string,
    private readonly maxRows: number,
    private readonly unstableTies: boolean,
  ) {}

  private orderBy: string[] = []
  private limit: number | null = null
  private offset = 0

  eq(column: string, value: unknown): this {
    this.filters.push({ sql: `${column} = $`, params: [value] })
    return this
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ sql: `${column} >= $`, params: [value] })
    return this
  }

  /** Chainable, like PostgREST's: each call appends another sort key. */
  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderBy.push(options.ascending === false ? `${column} desc` : column)
    return this
  }

  /** PostgREST's inclusive [from, to] window. */
  range(from: number, to: number): this {
    this.offset = from
    this.limit = to - from + 1
    return this
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ sql: `${column} = any($)`, params: [values] })
    return this
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator !== 'is' || value !== null) {
      throw new Error(`pglite-postgrest: unsupported not(${operator})`)
    }
    this.filters.push({ sql: `${column} is not null`, params: [] })
    return this
  }

  private build(): { text: string; params: unknown[] } {
    const params: unknown[] = []
    const where = this.filters.map((filter) => {
      for (const param of filter.params) params.push(param)
      return filter.sql.replace('$', `$${params.length}`)
    })
    const clause = where.length === 0 ? '' : ` where ${where.join(' and ')}`
    // Postgres promises nothing about the order of rows a query does not fully
    // order, and an OFFSET window re-plans on every request. `unstableTies`
    // makes that permission explicit instead of hoping the planner exercises it:
    // with a fully unique ORDER BY there are no ties and this changes nothing;
    // with a partial one it scrambles them, which is exactly what loses or
    // duplicates rows across pages.
    const keys = [...this.orderBy]
    if (this.unstableTies) keys.push('random()')
    const order = keys.length === 0 ? '' : ` order by ${keys.join(', ')}`
    // PostgREST truncates every response at `db-max-rows`, whether or not the
    // caller asked for a window — that is the silent cut a single unpaged read
    // walks into.
    const capped = Math.min(this.limit ?? this.maxRows, this.maxRows)
    const window = ` limit ${capped} offset ${this.offset}`
    return {
      text: `select ${this.columns} from public.${this.table}${clause}${order}${window}`,
      params,
    }
  }

  async then<R1, R2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[] | null; error: QueryError | null }) => R1 | PromiseLike<R1>)
      | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    const { text, params } = this.build()
    const result = await this.db
      .query(text, params)
      .then((rows) => ({ data: toPostgrestJson(rows), error: null }))
      .catch((error: Error) => ({ data: null, error: toPostgrestError(error) }))
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

/**
 * PostgREST reports the SQLSTATE in `code` and the constraint in `details`/
 * `message`. The generator tells an expected compatibility violation from a real
 * failure by exactly that, so a harness that dropped the code would make the
 * distinction untestable.
 */
function toPostgrestError(error: Error): {
  message: string
  code?: string
  details?: string
} {
  const pgError = error as Error & { code?: string; detail?: string; constraint?: string }
  return {
    message: [error.message, pgError.constraint].filter(Boolean).join(' '),
    code: pgError.code,
    details: pgError.detail,
  }
}

/** Postgres OID of `date`. PGlite decodes it to a JS Date; PostgREST sends 'YYYY-MM-DD'. */
const OID_DATE = 1082

/**
 * PGlite hands back decoded JS values; PostgREST hands back JSON. The difference
 * that matters here is `date`, which arrives as a Date object and would reach the
 * calendar walker — which does string arithmetic — as something with no `.split`.
 * Converting it is not cosmetic: it is what makes this harness represent the
 * client the generator actually talks to.
 */
function toPostgrestJson(result: {
  rows: unknown[]
  fields: Array<{ name: string; dataTypeID: number }>
}): unknown[] {
  const dateColumns = new Set(
    result.fields.filter((field) => field.dataTypeID === OID_DATE).map((field) => field.name),
  )
  if (dateColumns.size === 0) return result.rows

  return result.rows.map((row) => {
    const out: Record<string, unknown> = { ...(row as Record<string, unknown>) }
    for (const column of dateColumns) {
      const value = out[column]
      if (value instanceof Date) {
        const year = value.getFullYear()
        const month = String(value.getMonth() + 1).padStart(2, '0')
        const day = String(value.getDate()).padStart(2, '0')
        out[column] = `${year}-${month}-${day}`
      }
    }
    return out
  })
}

function quote(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  return `'${String(value).replace(/'/g, "''")}'`
}

async function insert(
  db: PGlite,
  table: string,
  payload: unknown,
): Promise<{ error: QueryError | null }> {
  const rows = (Array.isArray(payload) ? payload : [payload]) as Array<Record<string, unknown>>
  if (rows.length === 0) return { error: null }

  const columns = Object.keys(rows[0])
  const values = rows
    .map((row) => `(${columns.map((column) => quote(row[column])).join(', ')})`)
    .join(', ')

  // One statement, exactly like PostgREST sends it: a unique violation on any
  // row rejects the whole thing. That is the behaviour the fallback exists for.
  return db
    .exec(`insert into public.${table} (${columns.join(', ')}) values ${values};`)
    .then(() => ({ error: null }))
    .catch((error: Error) => ({ error: toPostgrestError(error) }))
}

/**
 * A client shaped like the one the generator takes, backed by `db`.
 *
 * `maxRows` mirrors PostgREST's `db-max-rows`, which Supabase sets: it caps EVERY
 * response, including one that asked for a bigger window. Tests lower it so a
 * modest fixture reproduces the truncation a real project only hits at a
 * thousand rows.
 *
 * `unstableTies` exercises the other half of paging: rows an ORDER BY does not
 * distinguish may come back in a different order on each request, so an OFFSET
 * window over a non-unique order silently repeats or skips them.
 */
export function pglitePostgrest(
  db: PGlite,
  options: { maxRows?: number; unstableTies?: boolean } = {},
): GranaSupabaseClient {
  const maxRows = options.maxRows ?? 1000
  const unstableTies = options.unstableTies ?? false
  return {
    from(table: string) {
      return {
        select: (columns: string) => new Query(db, table, columns, maxRows, unstableTies),
        insert: (payload: unknown) => insert(db, table, payload),
      }
    },
  } as unknown as GranaSupabaseClient
}
