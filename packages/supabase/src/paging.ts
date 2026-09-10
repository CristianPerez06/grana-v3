/**
 * Exhaustive reads over PostgREST.
 *
 * PostgREST truncates every response at its `db-max-rows` — Supabase sets one —
 * and says nothing about it: the caller gets a short array that looks exactly
 * like the end of the data. Anything that reasons about a COMPLETE set (what a
 * rule already owes, which occurrences already exist) is wrong the moment it
 * reads a truncated page, and wrong silently.
 */

type PageResult = { data: unknown[] | null; error: { message: string } | null }

/** Rows requested per page. The server may return fewer; that is not the end. */
const PAGE_SIZE = 1000

/** Refuses to spin forever if a server ignores the range window entirely. */
const MAX_PAGES = 1000

/**
 * Read every row a query matches, page by page.
 *
 * TWO RULES the caller has to honour, because neither can be enforced here:
 *
 * 1. **Order by columns that are UNIQUE together.** `range` is an OFFSET window
 *    and Postgres promises nothing about how it breaks ties between one request
 *    and the next, so a partial order can repeat rows across pages or skip them.
 *    A primary key as the last sort key is always enough.
 * 2. **Build the query inside the callback.** Each page needs its own builder;
 *    a shared one accumulates `range` calls.
 *
 * It stops on an EMPTY page, never on a short one: a short page can simply mean
 * the server's cap is lower than the window asked for.
 */
export async function selectAllPages<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<PageResult> },
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await build().range(out.length, out.length + PAGE_SIZE - 1)
    if (error) return { data: out, error }
    const rows = (data ?? []) as T[]
    if (rows.length === 0) return { data: out, error: null }
    out.push(...rows)
  }

  return { data: out, error: { message: 'Read did not terminate: too many pages.' } }
}
