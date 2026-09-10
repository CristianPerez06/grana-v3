import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Where the review surfaces live, and what they read.
 *
 * These assert on the CALL SITES, not on the helpers: the helpers were already
 * right and the defects were all about who called them. The materialization
 * notice rendered only on Inicio and Movimientos while generation ran on every
 * screen; the native row never said what confirming would write; both platforms
 * sorted and displayed occurrences by `scheduled_date`, a legacy column whose
 * value on a resolved row is the day it was paid, not the day it fell due.
 *
 * `apps/mobile` has no test runner, so for native this static check stands in
 * for a render test. It is deliberately narrow: it only looks at which helper a
 * file calls and which column it reads.
 */

const repoRoot = path.resolve(__dirname, '../../../../..')
const read = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8')

const WEB_SHELL = 'apps/web/app/(app)/_components/app-shell.tsx'
const NATIVE_SHELL = 'apps/mobile/app/(app)/_layout.tsx'

const WEB_BLOCK = 'apps/web/lib/recurrences/components/pending-recurrences-block.tsx'
const NATIVE_BLOCK = 'apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx'

const WEB_FEED = 'apps/web/lib/recurrences/components/pending-recurrences-block-container.tsx'

// Every surface that used to host the materialization notice, or a generation
// trigger of its own. None of them may host one now: the notice is the shell's.
const ROUTE_SURFACES = [
  'apps/web/app/(app)/transactions/_components/transactions-shell.tsx',
  'apps/web/app/(app)/dashboard/_components/dashboard-content.tsx',
  'apps/mobile/app/(app)/dashboard.tsx',
  'apps/mobile/app/(app)/transactions/index.tsx',
  'apps/mobile/app/(app)/transactions/recurring/index.tsx',
]

describe('the materialization notice belongs to the shell', () => {
  it.each([WEB_SHELL, NATIVE_SHELL])('%s renders it', (file) => {
    expect(read(file)).toContain('<MaterializationNotice')
  })

  it.each(ROUTE_SURFACES)('%s does not', (file) => {
    // Rendering it per route is what made a failure invisible in Cuentas,
    // Tarjetas or Ahorros — exactly where it had just happened, because
    // generation now runs on every screen.
    expect(read(file)).not.toContain('MaterializationNotice')
  })
})

describe('both review blocks read the vencimiento, not the legacy column', () => {
  it.each([WEB_BLOCK, NATIVE_BLOCK])('%s never reads scheduled_date', (file) => {
    expect(read(file)).not.toMatch(/\.scheduled_date\b/)
  })

  it.each([WEB_BLOCK, NATIVE_BLOCK])('%s reads due_date', (file) => {
    expect(read(file)).toMatch(/\.due_date\b/)
  })

  it.each([WEB_BLOCK, NATIVE_BLOCK])('%s shares the urgency and collapse rules', (file) => {
    const source = read(file)
    expect(source).toContain('reviewUrgency')
    expect(source).toContain('shouldOpenReviewBlock')
  })
})

describe('the native row says what web says', () => {
  it.each([WEB_BLOCK, NATIVE_BLOCK])('%s previews what resolving will write', (file) => {
    // Native used to stop at title, date and amount, so confirming meant
    // guessing which movement, on which date, in which account.
    const source = read(file)
    expect(source).toContain('resolutionPreview')
    for (const kind of ['expense', 'income', 'transfer']) {
      expect(source).toContain(`pending.will_create.${kind}`)
    }
    // Either spelling of the interpolation slot — `amount: x` or the shorthand
    // `amount,` — counts; what matters is that all four reach the message.
    for (const slot of ['amount', 'date', 'account', 'destination']) {
      expect(source).toMatch(new RegExp(`\\b${slot}\\s*[:,]`))
    }
  })
})

describe('a failed read of the pending occurrences is visible on both platforms', () => {
  it.each([WEB_FEED, NATIVE_BLOCK])('%s tells the two apart', (file) => {
    const source = read(file)
    expect(source).toContain('reviewFeedState')
    expect(source).toContain('RecurrenceFailureNotice')
    expect(source).toContain('read_failed_title')
    // `data ?? []` is the shape of the defect: it turns the error into an empty
    // list, and the block then renders nothing at all.
    expect(source).not.toMatch(/data\s*\?\?\s*\[\]\s*$/m)
  })
})

describe('the "al registrarlo" line reads as a date, not as an ISO string', () => {
  // Caught in QA: web interpolated `preview.date` raw, so the row said "el
  // 2026-09-08" under a header reading "Jueves, 10 de septiembre". Native had
  // always formatted it, so this was also the two platforms disagreeing.
  it.each([WEB_BLOCK, NATIVE_BLOCK])('%s formats it', (file) => {
    const source = read(file)
    expect(source).toMatch(/date: formatShortDate\(/)
  })
})

describe('the native materialization notice clears the status bar', () => {
  // Caught in QA on an iPhone with a Dynamic Island: the notice is mounted in
  // the app layout ABOVE every screen's `PageHeader`, so it is the top-most
  // thing on screen and nothing else was clearing the notch for it — the text
  // rendered under the island and the button came out half-covered.
  //
  // The inset belongs to the notice, not to the layout that mounts it: the
  // notice renders nothing most of the time, and padding applied one level up
  // would leave a permanent gap at the top of the app for a notice that is not
  // there.
  const NATIVE_NOTICE = 'apps/mobile/components/recurrences/MaterializationNotice.tsx'

  it('applies the top safe-area inset itself', () => {
    const source = read(NATIVE_NOTICE)
    expect(source).toContain('useSafeAreaInsets')
    expect(source).toMatch(/paddingTop: insets\.top/)
  })

  it('does not push the inset up into the layout, where it would always apply', () => {
    expect(read('apps/mobile/app/(app)/_layout.tsx')).not.toContain('useSafeAreaInsets')
  })

  // And the second half, which the first QA round missed: taking the inset is
  // not enough if the header below takes it AGAIN. That left a navy band the
  // height of the notch between the notice and the title, with the status bar's
  // white clock stranded on a page-colored strip above it.
  it('paints the inset navy and says it took it', () => {
    const source = read(NATIVE_NOTICE)
    expect(source).toContain('TopInsetTakenProvider')
    expect(source).toContain('bg-navy')
  })

  // Sitting on navy has a second consequence, found on the next QA round: the
  // failure notice was painted with a 6%-alpha red, which is another way of
  // writing "the surface behind me is light". On the navy band the card went
  // dark and its title — `--text`, which IS the navy — vanished into it. Every
  // surface in this notice has to carry its own color.
  it('does not let the ground it sits on show through', () => {
    expect(read(NATIVE_NOTICE)).not.toMatch(/backgroundColor:[^,\n]*rgba\(/)
  })

  it.each([
    'apps/mobile/components/ui/PageHeader.tsx',
    'apps/mobile/components/dashboard/DashboardHeader.tsx',
  ])('%s clears the inset only when nothing above it did', (file) => {
    const source = read(file)
    expect(source).toContain('useHeaderEdges')
    // The literal is what the double band was: `edges` decided at the call site
    // rather than read from whoever is above.
    expect(source).not.toMatch(/edges=\{\['top'\]\}/)
  })
})

describe('the pending read comes back, one way or another', () => {
  // A read that hangs is not an empty list, but for as long as it hangs the feed
  // is in `loading` and renders NOTHING — which is what somebody with no
  // vencimientos sees. `fetch` does not reject when there is no route to the
  // host, so without a deadline that state lasted as long as the OS felt like.
  const SHARED_READ = 'packages/recurrences/src/queries.ts'

  it('the shared read carries the deadline, so both platforms get it', () => {
    expect(read(SHARED_READ)).toContain('withReadTimeout(readPendingRecurrenceInstances(')
  })

  // The deadline is only half of it: one automatic retry on top of 15 seconds is
  // thirty seconds of the same silence, and the user never asked for the second
  // attempt. Native has no test runner, so this stands in for it there; web's is
  // exercised for real in `pending-review-feed.test.tsx`.
  it.each([WEB_FEED, NATIVE_BLOCK])('%s does not retry it behind the user', (file) => {
    expect(read(file)).toContain('retry: false')
  })
})

describe('correcting the reference date exists on both platforms', () => {
  // #121. Native has no test runner, so the field's presence there is checked
  // statically — the same reason this file exists. What it guards is the half
  // that silently goes missing: a form that renders the picker but never puts
  // it in the payload looks finished and changes nothing.
  const WEB_EDIT = 'apps/web/app/(app)/transactions/recurring/[id]/_components/recurrence-edit-drawer.tsx'
  const NATIVE_EDIT = 'apps/mobile/components/recurrences/RecurrenceEditForm.tsx'

  it.each([WEB_EDIT, NATIVE_EDIT])('%s offers the field and sends it', (file) => {
    const source = read(file)
    expect(source).toContain('labels.reference_date')
    expect(source).toMatch(/start_date:\s*startDate/)
  })

  it.each([WEB_EDIT, NATIVE_EDIT])('%s explains what happens to what already exists', (file) => {
    expect(read(file)).toContain('reference_date_hint')
  })
})
