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
  withGenerationTimeout,
  GENERATION_TIMEOUT_MS,
  withReadTimeout,
  READ_TIMEOUT_MS,
  READ_TIMEOUT_ERROR,
  getTopRecurrenceSuggestion,
  getDuplicateRulesFor,
  buildPendingInstanceInsert,
  selectReconstructionBatch,
  reconstructionHorizon,
  RECONSTRUCTION_BATCH_SIZE,
  type RuleBacklog,
  type GenerationResult,
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
  closeAmounts,
  DUPLICATE_AMOUNT_TOLERANCE,
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
  EnrichedRecurrenceInstance,
  PendingInstance,
  PendingRecurrenceInstance,
  RecurrenceAccount,
  RecurrenceCategory,
  RecurrenceSubcategory,
  RecurrenceMovementType,
  RecurrenceStatus,
  RecurrenceInstanceStatus,
  RecurrenceCurrencyCode,
} from './types'

export {
  shouldOpenReviewBlock,
  reviewUrgency,
  resolutionPreview,
  materializationOutcome,
  reviewFeedState,
  stuckRules,
  canUnlink,
  recurrenceLinkLabelKey,
  type ReviewUrgency,
  type ResolutionPreview,
  type MaterializationOutcome,
  type ReviewFeedState,
  type StuckRule,
} from './review-surface'
export {
  getRecurrenceLinkCandidates,
  linkMovementToRecurrence,
  unlinkMovementFromRecurrence,
  registerRecurrenceAhead,
  describeBlockingSettlements,
  admitsOccurrence,
  type LinkCandidate,
  type LinkErrorCode,
  type LinkResult,
  type UnlinkResult,
  type RegisterAheadResult,
  type BlockingSettlements,
} from './link'

export { recurrenceTitle, type RecurrenceTitleParts } from './display-title'
export { referenceDateChoice } from './schedule-edit'
export type { ReferenceDateChoice } from './schedule-edit'
