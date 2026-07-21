// @grana/shared — platform-agnostic data layer for the Compartido (shared
// household) domain. Reads take a Supabase client as their first argument;
// write mutator-cores validate + call the atomic RPC and return a typed result
// with no platform glue. Consumed by both apps/web and apps/mobile. UI-free by
// design so it never pulls a second copy of React into the monorepo.

export type {
  Household,
  HouseholdMember,
  DebtByCurrency,
  PendingSettlement,
  SharedExpenseItem,
} from './types'

export {
  getHousehold,
  getHouseholdDebt,
  getHouseholdOutlook,
  getCurrentAccount,
  getPendingSettlements,
  getSharedAccruedMovements,
  getMovementSharedInfo,
  getSharedExpenses,
  type CurrentAccountData,
  type MovementSharedInfo,
} from './queries'

export {
  createHouseholdCore,
  createInviteCore,
  joinHouseholdCore,
  updateHouseholdConfigCore,
  leaveHouseholdCore,
  registerSettlementCore,
  assignSettlementAccountCore,
  deleteSettlementCore,
  type SharedMutationResult,
} from './mutations'
