---
name: grana-route-shell
description: "Always-visible chrome" pattern for web and mobile routes — header mounted on first paint, isolated sections that handle their own loading/error without taking down the route, and per-section min-heights to prevent flicker when data resolves. Codified from /cards. Apply when building any new route with header + N sections that depend on queries.
---

# Route shell pattern (always-visible chrome)

When you build a new route (web or mobile) with **header + N sections that depend on queries**, follow this pattern so the user never sees a blank screen, never loses the chrome to a partial error, and never suffers layout shift when data resolves.

Origin: `/cards` (archived in `openspec/changes/archive/2026-06-01-implement-mobile-cards-route/`). Complements the `route-loading-and-errors` spec (primitive components `Spinner` and `RouteError`); this skill covers **composition** at the route level.

## The three invariants

1. **The header mounts on first paint, before any body query resolves.**
   - If the header has a subtitle derived from a query (count, month, etc.), show a placeholder (`-` or equivalent) while loading. If the query fails, leave the placeholder indefinitely — don't block the rest of the header.
   - If the header has a CTA (button) whose flow depends on catalogs/data that haven't arrived yet, render the button **disabled** (same look, `disabled={true}`, no `onPress`/`onClick`). Enable it when data arrives. If data never arrives (query fails, child route doesn't exist yet), the button stays disabled.
   - The "now" month/date comes from `getTodayAR()` and does NOT depend on queries — it's available from the first render.

2. **Each body section is an isolated component that handles its own loading/error.**
   - Each section fires its own query (web: server container with `try/catch` wrapped in `<Suspense>`; mobile: `useQuery` directly in the component).
   - Each section returns its own `SectionFallback` while loading or on failure.
   - An error in one section NEVER takes down the route, hides the header, or affects other sections.
   - Composition at the route level is just that: composition. The parent route does NOT fire queries; it delegates to the sections.

3. **Each section reserves its vertical slot with a `min-h-[Xrem]`.**
   - The min-height goes on the **fallback** (loading/error), not on the resolved content. The idea is to reserve a slot while loading, not to constrain content when it arrives.
   - If a section shows nothing in `isPending` (e.g. empty archived list on mobile), don't put min-height on loading: you avoid a phantom slot when the query resolves with zero data.

## Web recipe (Next App Router + Suspense)

```
app/(app)/<route>/
├── page.tsx                          ← composes header + <Suspense> scaffold
└── _components/
    ├── <route>-header.tsx            ← 'use client', header-owned queries
    ├── <section-a>.tsx               ← pure presentational
    ├── <section-a>-container.tsx     ← async server, fetch + try/catch
    ├── <section-a>-section.tsx       ← (optional) wrapper with title/hint
    ├── ...
    └── <route>-error-boundary.tsx    ← Client Component, safety net
```

**page.tsx:**

```tsx
const RoutePage = async () => {
  // ... auth check, redirect if needed ...
  const t = await getTranslations('<route>.route')
  return (
    <div className="flex flex-col gap-6">
      <RouteHeader />
      <RouteErrorBoundary>
        <div className="flex flex-col gap-6">
          <Suspense fallback={<SectionFallback message={t('a_loading')} className="min-h-[14rem]" />}>
            <SectionAContainer />
          </Suspense>
          <Suspense fallback={<SectionFallback message={t('b_loading')} className="min-h-[18rem]" />}>
            <SectionBContainer />
          </Suspense>
        </div>
      </RouteErrorBoundary>
    </div>
  )
}
```

**`<section>-container.tsx` (server async):**

```tsx
export const SectionAContainer = async () => {
  let data: TheShape
  try {
    data = await getTheThing()
  } catch {
    const t = await getTranslations('<route>.route')
    return <SectionFallback message={t('a_error')} />
  }
  return <SectionAPresentational data={data} />
}
```

Each container wraps its fetch in `try/catch` and returns an error `<SectionFallback>` on failure, instead of propagating the throw. That isolates errors between sections.

The `<RouteErrorBoundary>` is a Client Component, catches any throw that escapes the containers and replaces the content area with `<RouteError>` without hiding the header. `onRetry` resets the boundary's state.

**Header (`'use client'`):**

```tsx
export const RouteHeader = () => {
  const [count, setCount] = useState<number | null>(null)
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null)
  // useEffect → supabase queries → setCount / setCatalogs ...

  return (
    <PageHeader
      title={t('title')}
      description={count == null ? t('subtitle_loading', { month }) : t('subtitle', { count, month })}
      actions={<AddXButton disabled={catalogs == null} institutions={...} networks={...} />}
    />
  )
}
```

## Mobile recipe (Expo Router + TanStack Query)

```
app/(app)/<route>.tsx                         ← composes header + ScrollView with N sections
components/<route>/
├── <Route>Header.tsx                         ← PageHeader + useQuery(count) + CTA placeholder
├── <SectionA>.tsx                            ← pure presentational
├── <SectionB>.tsx                            ← pure presentational
├── ...
```

**`app/(app)/<route>.tsx`:**

```tsx
export default function RouteScreen() {
  return (
    <View className="flex-1 bg-background">
      <RouteHeader />
      <ScrollView contentContainerClassName="gap-6 px-6 py-6">
        <SectionA />
        <SectionB />
      </ScrollView>
    </View>
  )
}

const SectionA = () => {
  const t = useT()
  const query = useQuery({
    queryKey: ['<route>', 'a'] as const,
    queryFn: getTheThing,
  })
  if (query.isPending)
    return <SectionFallback message={t('<route>.route.a_loading')} className="min-h-[14rem]" />
  if (query.isError)
    return <SectionFallback message={t('<route>.route.a_error')} className="min-h-[14rem]" />
  return <SectionAPresentational data={query.data} />
}
```

Each section is a small function in the same route file (or a component co-located alongside), with its own `useQuery`. **There is no global error boundary on mobile** — isolation comes from each section handling its own `isPending`/`isError`.

**`<Route>Header.tsx`:**

```tsx
export const RouteHeader = () => {
  const t = useT()
  const locale = useLocale()
  const monthLabel = getTodayAR().toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )

  const countQuery = useQuery({
    queryKey: ['<route>', 'count'] as const,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('<table>')
        .select('id', { count: 'exact', head: true })
        // ... filters ...
      if (error) throw error
      return count ?? 0
    },
  })

  const description =
    countQuery.data == null
      ? t('<route>.route.subtitle_loading', { month: monthLabel })
      : t('<route>.route.subtitle', { count: countQuery.data, month: monthLabel })

  return (
    <PageHeader
      title={t('<route>.title')}
      description={description}
      actions={<AddXPlaceholder label={t('<route>.actions.add_label')} />}
    />
  )
}
```

**Mobile CTA placeholder** (when the child route doesn't exist yet or catalogs are loading):

```tsx
const AddXPlaceholder = ({ label }: { label: string }) => (
  <Pressable
    disabled
    accessibilityState={{ disabled: true }}
    className="flex-row items-center gap-1.5 rounded-xl bg-emerald px-3 py-2 opacity-50"
  >
    <Plus size={16} color="white" strokeWidth={3} />
    <Text className="text-sm font-semibold text-white">{label}</Text>
  </Pressable>
)
```

## SectionFallback (mobile)

```tsx
type Props = { message: string; className?: string }

export const SectionFallback = ({ message, className }: Props) => (
  <View
    className={`items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 ${className ?? ''}`}
  >
    <Text className="text-center text-sm text-text-muted">{message}</Text>
  </View>
)
```

`items-center justify-center` keeps the text centered when `min-h-[Xrem]` kicks in. The `className` accepts an override from each call site.

## Min-heights — how to pick the value

Aim for a height **close to the resolved content** to minimize the shift when data arrives. Values we use in /cards (literal from web):

| Section                       | min-h        |
|-------------------------------|--------------|
| Hero / summary card           | `min-h-[14rem]` (224px) |
| Main list / wallet            | `min-h-[18rem]` (288px) |
| Collapsible archived band     | `min-h-[3rem]` (48px) — error only |

If mobile content is taller than web (because it's stacked vs grid), bump the value (e.g. `min-h-[22rem]` for a stacked hero). If the content is optional and may be nothing (e.g. archived with N=0), **don't reserve a slot during loading** — return `null` on `isPending`, and apply `min-h` only to the error fallback.

## i18n

Each route has its `<route>.route` namespace with:

```json
{
  "<route>": {
    "route": {
      "subtitle": "{count} ... · ... {month}",
      "subtitle_loading": "- ... · ... {month}",
      "a_loading": "Loading ...",
      "a_error": "We couldn't load ...",
      "b_loading": "Loading ...",
      "b_error": "We couldn't load ..."
    }
  }
}
```

**Important for mobile:** the mobile interpolator (`apps/mobile/lib/i18n.ts`) **does not support ICU plurals**. If the header subtitle needs a plural, add a simple key with `{count}` and accept that "1 cards" sounds odd (or branch in JS); do not use `{count, plural, ...}` syntax in strings that mobile consumes.

## How to apply it to a new route — checklist

- [ ] Header is mounted before any `<Suspense>` (web) or section ScrollView (mobile).
- [ ] Header subtitle shows a placeholder (`-` or equivalent) while the count query loads.
- [ ] If the header has a CTA, it renders disabled while catalogs/dependencies haven't resolved (or permanently if the child route doesn't exist yet).
- [ ] The body is split into N sections, **each with its own query**.
- [ ] Each section returns its own `SectionFallback` on loading and error.
- [ ] Each `SectionFallback` (loading + error) has a `min-h-[Xrem]` that approximates the resolved content.
- [ ] Sections that can resolve with "nothing" (empty archived list, etc.) return `null` on `isPending` so they don't leave a phantom slot.
- [ ] **Web**: each async container wraps its fetch in `try/catch` and returns an error `<SectionFallback>` instead of throwing.
- [ ] **Web**: `<RouteErrorBoundary>` Client Component wraps the Suspense scaffold as a safety net.
- [ ] **Mobile**: no global error boundary; each `useQuery` handles its error inline.
- [ ] `<route>.route.*` strings defined in both locales of the i18n bundle.
- [ ] Module spec reflects the recipe — if the route is new, add a Requirement with scenarios for "header is visible before queries" + "one section error does not take down the header" + "min-h per section".

## Common mistakes to avoid

- **Firing all body queries from the route parent.** Breaks isolation; a failure in any sub-query blocks the ENTIRE body.
- **Sharing a single query between header and body.** The header gets tied to the heaviest fetch and can't paint earlier.
- **Applying `min-h` to the resolved content.** If the content is taller, it keeps growing (OK); if it's shorter, you get a permanent empty slot (NOT OK). Keep `min-h` only on the fallback.
- **Hiding the CTA when data is missing.** The user loses the trail that the flow exists. Render it disabled.
- **`router.push('/<route>/new')` when that child route doesn't exist yet.** Better to use a disabled placeholder until it lands; avoids the 404.
- **Reusing the `WalletGrid`/`AccountGrid`/etc. component with a name that locks in the implementation.** For cross-platform, name by concept (`Wallet`, `AccountList`) and let each platform choose grid vs carousel internally.
