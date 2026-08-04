// @grana/recurrences — the isomorphic recurrence data layer (reads + lazy
// generator + suggestion enrichment + lifecycle/instance mutations), consumed by
// both the web server actions and the mobile mutators. Auth + cache invalidation
// stay in each platform's shell. The pure date/frequency/suggestion math lives in
// @grana/money-logic; the thin movement creates confirm delegates to live in
// @grana/transactions-mutations.

export {
  getRecurrences,
  getPendingRecurrenceInstances,
  getPendingInstancesByRecurrenceId,
  getRecurrenceDetail,
  countPendingSharedRecurrenceInstances,
  getRecurrenceLinkedTransactionIds,
  getRecurrenceLinkForTransaction,
  generateDueRecurrenceInstances,
  getTopRecurrenceSuggestion,
  getDuplicateRulesFor,
  buildPendingInstanceInsert,
  type RecurrenceRuleForGeneration,
} from './queries'

export {
  createRecurrence,
  confirmRecurrenceInstance,
  skipRecurrenceInstance,
  updateRecurrence,
  pauseRecurrence,
  resumeRecurrence,
  deleteRecurrence,
  deleteMovementResolvingRecurrence,
  acceptRecurrenceSuggestion,
  dismissRecurrenceSuggestion,
  type RecurrenceActionResult,
  type RecurrenceHousehold,
  type SeededRecurrenceResolution,
} from './mutations'
export {
  findDuplicateRules,
  groupDuplicateRules,
  duplicateRuleIds,
  type DuplicateCandidate,
  type DuplicateMatch,
  type ExistingRuleForDuplicateCheck,
} from './duplicates'

export {
  mapInstanceToConfirmPlan,
  RecurrenceMapError,
  type ConfirmInstancePlan,
  type ConfirmInstanceContext,
  type InstanceSnapshot,
  type RecurrenceMapErrorCode,
} from './mapper'

export type {
  Recurrence,
  RecurrenceInstance,
  RecurrenceSummary,
  RecurrenceDetail,
  PendingRecurrenceInstance,
  RecurrenceAccount,
  RecurrenceCategory,
  RecurrenceSubcategory,
  RecurrenceMovementType,
  RecurrenceStatus,
  RecurrenceInstanceStatus,
  RecurrenceCurrencyCode,
} from './types'
