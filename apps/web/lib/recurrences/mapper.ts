// The instance→movement confirm mapper lives in @grana/recurrences so web and
// mobile share it. Re-exported here to avoid churning imports across the web app.
export {
  mapInstanceToConfirmPlan,
  RecurrenceMapError,
  type ConfirmInstancePlan,
  type ConfirmInstanceContext,
  type InstanceSnapshot,
  type RecurrenceMapErrorCode,
} from '@grana/recurrences'
