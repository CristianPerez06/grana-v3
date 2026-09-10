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
 * Deliberately partial: `select` with `eq` / `in` / `gte` / `not(col,'is',null)` /
 * `order` / `range` / `maybeSingle`, embedded resources of the
 * `alias:table[!constraint](cols)` form, and `insert`. Anything else throws
 * instead of silently returning nothing, so a read that grows a new call cannot
 * pass by accident.
 */

type Filter = { sql: string; params: unknown[] }

type QueryError = { message: string; code?: string; details?: string }

class Query implements PromiseLike<{ data: unknown[] | null; error: QueryError | null }> {
  private filters: Filter[] = []

  constructor(
    private readonly db: PGlite,
    private readonly table: string,
    select: string,
    private readonly maxRows: number,
    private readonly unstableTies: boolean,
  ) {
    const parsed = parseSelect(table, select)
    this.columns = parsed.columns
    this.embeds = parsed.embeds
  }

  private readonly columns: string
  private readonly embeds: Embed[]
  private singleRow = false
  private requireRow = false

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

  /** PostgREST returns the row itself, or null, instead of an array. */
  maybeSingle(): this {
    this.singleRow = true
    this.limit = 1
    return this
  }

  /** Like maybeSingle, but a missing row comes back as an error. */
  single(): this {
    this.singleRow = true
    this.limit = 1
    this.requireRow = true
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
      .then(async (rows) => ({
        data: await this.attachEmbeds(toPostgrestJson(rows)),
        error: null,
      }))
      .catch((error: Error) => ({ data: null, error: toPostgrestError(error) }))
    const row = this.singleRow ? (result.data?.[0] ?? null) : null
    const shaped =
      this.singleRow && result.error == null
        ? {
            data: row as never,
            error:
              row == null && this.requireRow
                ? { message: 'JSON object requested, multiple (or no) rows returned' }
                : null,
          }
        : result
    return Promise.resolve(shaped as never).then(onfulfilled, onrejected)
  }

  /**
   * Resolve each embedded resource with one query keyed by its foreign key, the
   * way PostgREST's join looks from the client: the alias holds the related row,
   * or null when the local column is null.
   */
  private async attachEmbeds(rows: unknown[]): Promise<unknown[]> {
    if (this.embeds.length === 0 || rows.length === 0) return rows

    const typed = rows as Array<Record<string, unknown>>
    for (const embed of this.embeds) {
      const keys = [...new Set(typed.map((row) => row[embed.fkColumn]).filter(Boolean))]
      const related = new Map<unknown, unknown>()
      if (keys.length > 0) {
        const columns = embed.columns === '*' ? '*' : `id, ${embed.columns}`
        const result = await this.db.query(
          `select ${columns} from public.${embed.table} where id = any($1)`,
          [keys],
        )
        for (const row of toPostgrestJson(result) as Array<Record<string, unknown>>) {
          related.set(row.id, row)
        }
      }
      for (const row of typed) {
        row[embed.alias] = related.get(row[embed.fkColumn]) ?? null
      }
    }
    return typed
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

/**
 * An embedded resource in a PostgREST select: `alias:table(cols)`, optionally
 * with a `!constraint` hint when two foreign keys point at the same table.
 */
type Embed = { alias: string; table: string; columns: string; fkColumn: string }

/** Split a select list on commas that are NOT inside an embed's parentheses. */
function splitSelect(select: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of select) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

/**
 * Which local column an embed joins on. With a `!constraint` hint PostgREST
 * names the foreign key, and this repo's constraints are `<table>_<column>_fkey`
 * — the only way to tell `account` from `destination_account`, which both point
 * at `accounts`. Without a hint the convention is `<alias>_id`.
 */
function foreignKeyColumn(baseTable: string, alias: string, hint: string | null): string {
  if (hint == null) return `${alias}_id`
  const withoutSuffix = hint.replace(/_fkey$/, '')
  const withoutTable = withoutSuffix.startsWith(`${baseTable}_`)
    ? withoutSuffix.slice(baseTable.length + 1)
    : withoutSuffix
  return withoutTable
}

function parseSelect(
  baseTable: string,
  select: string,
): { columns: string; embeds: Embed[] } {
  const columns: string[] = []
  const embeds: Embed[] = []

  for (const part of splitSelect(select)) {
    const match = /^(\w+)\s*:\s*(\w+)(?:!(\w+))?\s*\(([\s\S]*)\)$/.exec(part)
    if (match == null) {
      columns.push(part)
      continue
    }
    const [, alias, table, hint, embeddedColumns] = match
    embeds.push({
      alias,
      table,
      columns: embeddedColumns.trim(),
      fkColumn: foreignKeyColumn(baseTable, alias, hint ?? null),
    })
  }

  return { columns: columns.length === 0 ? '*' : columns.join(', '), embeds }
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
 * `update(...).eq(...)….select(cols)`, the shape the recurrence mutations use.
 * Runs one UPDATE ... RETURNING, so a filter that matches nothing comes back as
 * an empty array rather than as an error — which is exactly what those mutations
 * check to detect a row somebody else resolved first.
 */
class UpdateQuery implements PromiseLike<{ data: unknown[] | null; error: QueryError | null }> {
  private filters: Filter[] = []

  constructor(
    private readonly db: PGlite,
    private readonly table: string,
    private readonly payload: Record<string, unknown>,
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ sql: `${column} = $`, params: [value] })
    return this
  }

  select(columns = '*') {
    return this.run(columns)
  }

  private run(columns: string) {
    const assignments = Object.entries(this.payload)
      .map(([column, value]) => `${column} = ${quote(value)}`)
      .join(', ')
    const params: unknown[] = []
    const where = this.filters.map((filter) => {
      for (const param of filter.params) params.push(param)
      return filter.sql.replace('$', `$${params.length}`)
    })
    const clause = where.length === 0 ? '' : ` where ${where.join(' and ')}`
    return this.db
      .query(
        `update public.${this.table} set ${assignments}${clause} returning ${columns}`,
        params,
      )
      .then((result) => ({ data: toPostgrestJson(result), error: null }))
      .catch((error: Error) => ({ data: null, error: toPostgrestError(error) }))
  }

  then<R1, R2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[] | null; error: QueryError | null }) => R1 | PromiseLike<R1>)
      | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.run('*').then(onfulfilled, onrejected)
  }
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
    /** `select public.<fn>(args)`, the shape PostgREST turns an RPC call into. */
    async rpc(name: string, args: Record<string, unknown> = {}) {
      const entries = Object.entries(args)
      const params = entries.map(([, value]) => value)
      const call = entries
        .map(([key], index) => `${key} => $${index + 1}`)
        .join(', ')
      return db
        .query(`select public.${name}(${call})`, params)
        .then(() => ({ data: null, error: null }))
        .catch((error: Error) => ({ data: null, error: toPostgrestError(error) }))
    },
    from(table: string) {
      return {
        select: (select: string) => new Query(db, table, select, maxRows, unstableTies),
        insert: (payload: unknown) => insert(db, table, payload),
        update: (payload: Record<string, unknown>) => new UpdateQuery(db, table, payload),
      }
    },
  } as unknown as GranaSupabaseClient
}
