import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'
import type { Database } from './types'

export type GranaSupabaseClient = SupabaseClient<Database>

export const createClient = (
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<'public'>,
): GranaSupabaseClient =>
  createSupabaseClient<Database>(url, anonKey, options)
