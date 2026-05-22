// The generator decision lives in @grana/money-logic so mobile can reuse the
// exact same calculations. This file is a re-export kept to avoid churning
// imports across the rest of the app.

export {
  decideRecurrenceInstance,
  type RuleForDecision,
  type GenerationDecision,
} from '@grana/money-logic'
