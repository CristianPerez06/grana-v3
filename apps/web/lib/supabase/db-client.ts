import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@grana/supabase'

/**
 * Client-agnostic Supabase handle for query functions (web-data-access spec):
 * read queries take this as their first parameter instead of creating a
 * client internally, so the same function runs against the browser client
 * (`lib/supabase/client.ts`), the server client (`lib/supabase/server.ts`) or
 * mobile's native client.
 */
export type DbClient = SupabaseClient<Database>
