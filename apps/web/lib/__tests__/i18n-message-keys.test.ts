import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ═══════════════════════════════════════════════════════════════════════════
// Every literal translation key used by the apps must EXIST in both locales.
//
// This guard exists because a missing key is invisible to everything else we
// run: `tsc` types `t()` as `(key: string) => string`, ESLint has no idea, and
// `next build` compiles the component without ever rendering it. The failure
// only shows up as a runtime MISSING_MESSAGE the first time somebody opens the
// page — which is exactly how `dashboard.spending.credits_label` survived being
// deleted as "orphaned" while Movimientos was still calling it.
//
// Scope, deliberately narrow so the check is trustworthy rather than clever:
// a call is checked only when BOTH its namespace and its key are literals. A
// dynamic namespace (`getTranslations(NS_BY_KIND[kind])`) or a computed key
// (`t(\`state.${x}\`)`) is skipped — a scanner that guessed at those would
// produce false failures, and a guard that cries wolf gets deleted.
//
// This is a regex scan, not a parser, so it has no scopes: a file that rebinds
// `t` to a second namespace in another component gives that name two possible
// namespaces and no way to tell which call belongs to which. Such a key counts
// as resolved if it exists under ANY of them. A key that was deleted resolves
// under none, which is the case this guard is here to catch.
// ═══════════════════════════════════════════════════════════════════════════

const REPO_ROOT = resolve(__dirname, '../../../..')
const SCAN_ROOTS = [
  join(REPO_ROOT, 'apps/web'),
  join(REPO_ROOT, 'apps/mobile'),
  join(REPO_ROOT, 'packages'),
]
const SKIP_DIRS = new Set(['node_modules', '.next', '.expo', 'dist', 'build', '__tests__'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Flatten a messages tree into the dotted paths the apps actually call. */
function flatten(node: unknown, prefix = '', into = new Set<string>()): Set<string> {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, into)
    }
  } else if (prefix) {
    into.add(prefix)
  }
  return into
}

// Read the JSON off disk rather than importing it: the package's `exports` map
// does not expose the raw files, and the test wants the files as they are on
// disk anyway — that is what ships.
const messages = (locale: string): unknown =>
  JSON.parse(readFileSync(join(REPO_ROOT, `packages/i18n-messages/src/${locale}.json`), 'utf8'))

const esKeys = flatten(messages('es'))
const enKeys = flatten(messages('en'))

// Bindings that produce a translator, and the namespace each one is scoped to.
// `useT()` is the native app's root-scoped translator.
const BINDING =
  /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(useTranslations|getTranslations|useT)\s*\(\s*(?:(['"])([^'"]*)\3\s*)?\)/g

/** One call site: the key under each namespace its translator might be bound to. */
type Usage = { candidates: string[]; label: string; file: string }

function usagesIn(file: string): Usage[] {
  const src = readFileSync(file, 'utf8')
  const namespacesOf = new Map<string, Set<string>>()

  for (const m of src.matchAll(BINDING)) {
    const [, name, fn, , ns] = m
    // `useT()` takes no namespace; `useTranslations()` with no argument is root.
    const namespace = fn === 'useT' ? '' : (ns ?? '')
    const set = namespacesOf.get(name) ?? new Set<string>()
    set.add(namespace)
    namespacesOf.set(name, set)
  }
  if (namespacesOf.size === 0) return []

  const names = [...namespacesOf.keys()].map((n) => n.replace(/\$/g, '\\$')).join('|')
  // `t('key')`, `t.raw('key')`, `t.rich('key')`, `t.markup('key')`. `t.has()` is
  // an existence check — asserting on it would defeat its purpose.
  const call = new RegExp(`\\b(${names})(?:\\.(raw|rich|markup))?\\(\\s*(['"])([^'"\`]*?)\\3`, 'g')

  const out: Usage[] = []
  for (const m of src.matchAll(call)) {
    const [, name, , , key] = m
    if (key === '') continue
    const namespaces = namespacesOf.get(name)
    if (namespaces === undefined) continue
    const candidates = [...namespaces].map((ns) => (ns ? `${ns}.${key}` : key))
    out.push({ candidates, label: candidates.join(' | '), file: file.slice(REPO_ROOT.length + 1) })
  }
  return out
}

const usages = SCAN_ROOTS.flatMap(sourceFiles).flatMap(usagesIn)

describe('i18n messages', () => {
  it('scans a meaningful number of call sites (the guard itself still works)', () => {
    // If a refactor changes how translators are bound, the scanner would go
    // quiet and pass vacuously. This pins that it is still finding the calls.
    expect(usages.length).toBeGreaterThan(200)
  })

  it('has the same keys in es and en', () => {
    const onlyEs = [...esKeys].filter((k) => !enKeys.has(k)).sort()
    const onlyEn = [...enKeys].filter((k) => !esKeys.has(k)).sort()
    expect({ onlyEs, onlyEn }).toEqual({ onlyEs: [], onlyEn: [] })
  })

  it('resolves every literal key the apps use', () => {
    const missing = usages
      .filter((u) => !u.candidates.some((key) => esKeys.has(key) && enKeys.has(key)))
      .map((u) => `${u.label}  ←  ${u.file}`)
      .filter((line, i, all) => all.indexOf(line) === i)
      .sort()
    expect(missing).toEqual([])
  })
})
