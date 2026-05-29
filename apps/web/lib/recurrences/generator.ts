// The generator decision lives in @grana/money-logic so mobile can reuse the
// exact same calculations. This file is a re-export kept to avoid churning
// imports across the rest of the app.

export {
  decideRecurrenceInstance,
  presetToInterval,
  type RuleForDecision,
  type GenerationDecision,
  type IntervalUnit,
} from '@grana/money-logic'
