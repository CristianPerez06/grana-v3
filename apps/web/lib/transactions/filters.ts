// The movement filters contract + month helpers now live in `@grana/transactions`
// so the mobile Movimientos tab reuses them. Re-exported here so web keeps
// importing them from `@/lib/transactions/filters` unchanged. The React-state
// filter machine (`filters-state.ts`) and the filter UI stay in web.
export {
  resolveMonthRange,
  monthOf,
  shiftMonth,
  movementMatchesText,
  SUBCATEGORY_NONE_MARKER,
  DEFAULT_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENT_TYPE_KEYS,
} from '@grana/transactions'
export type {
  MovementFilters,
  MovementTypeFilter,
  MovementCurrencyFilter,
} from '@grana/transactions'
