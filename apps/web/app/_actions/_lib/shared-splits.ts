// Re-exported from `@grana/transactions-mutations` so the web actions still
// import from a stable in-app path. The orchestrator package owns the impl.
export {
  applySharedSplits,
  type SharedSplitSpec,
  type SharedTarget,
} from '@grana/transactions-mutations'
