# Diseño — Alinear el modelo de carga del dashboard mobile con el de web

## Contexto

El estado actual de `apps/mobile/app/(app)/dashboard.tsx` y el patrón objetivo ya conviven en el mismo archivo de pantalla. El padre orquesta tres queries (`useDashboardHero`, `useUpcomingFortnight`, `useHasMovements`) y aplica:

1. Un gate de spinner a pantalla completa: `initialLoading = hero.isPending && upcoming.isPending && movements.isPending`.
2. Render condicional por sección: `hero.data ? <HeroSection data/> : hero.error ? <SectionFallback/> : null`.

En cambio `MonthBalanceSection` **no** participa de esa orquestación: posee su query y su loading/error in-card sobre `SWAP_MIN_HEIGHT = 280`. Ese componente es el patrón de referencia; el resto del trabajo es alinear las demás secciones con él.

## Decisión 1 — Cada sección posee su query (no se introducen "containers")

Web separa `XContainer` (fetch, vía `<Suspense>`) de `X` (presentación, recibe `data`). En mobile **no** se replica esa separación: el patrón idiomático ya establecido por `MonthBalanceSection` es que el propio componente de sección llame su hook de query y maneje los tres estados internamente. Mantener un solo patrón en mobile (en vez de mezclar "container + presentational" para unas secciones y "todo-en-uno" para otras) gana consistencia.

Consecuencia en props:

| Componente | Antes | Después |
|---|---|---|
| `DashboardHeader` | `name`, `todayISO` | `todayISO` (absorbe `useProfileFirstName`) |
| `HeroSection` | `data: DashboardHero` | `—` (absorbe `useDashboardHero`) |
| `UpcomingFortnightSection` | `data: UpcomingFortnight` | `today: Date` (absorbe `useUpcomingFortnight`) |
| `MonthBalanceSection` | `currentYear`, `currentMonth`, `monthsBackLimit` | sin cambios (referencia) |
| `WelcomeFirstMoveCard` | `—` (padre gatea) | `—` (absorbe `useHasMovements`) |

`today` se sigue calculando una vez en el shell con `getTodayAR()` y se pasa a las secciones que lo necesitan (Upcoming, y el futuro teaser), para no recalcular "hoy" en cada componente ni arriesgar inconsistencias cerca de medianoche.

## Decisión 2 — El chrome queda fijo; solo la región de datos hace swap

Igual que `MonthBalanceSection` (título + navegador siempre visibles, solo el gráfico+footer hacen swap), `HeroSection` y `UpcomingFortnightSection` mantienen su título/label siempre montado y delegan **solo la zona de importes/lista** a un bloque con `minHeight` que intercambia:

```
┌─ Card (border, padding) ──────────── siempre visible
│  Label / título de la sección  ───── siempre visible
│  ┌─ swap region (minHeight) ─────┐
│  │  isPending → <Spinner/>       │ ── único que cambia
│  │  isError   → mensaje + retry  │
│  │  data      → contenido real   │
│  └───────────────────────────────┘
└───────────────────────────────────
```

Esto es incluso más estable que web (donde el `<Suspense>` reemplaza la card entera por un `SectionFallback`): en mobile el borde y el encabezado nunca parpadean.

`min-height` por sección: se elige por inspección visual del estado con datos típico (Hero ~1 línea ARS + 1 línea USD; Upcoming es la sección más alta). No se fijan números en la spec; el contrato es "sin layout shift entre pending/data/error". `MonthBalanceSection` ya usa 280 como referencia de orden de magnitud.

`SectionFallback` mobile hoy no tiene `minHeight` y solo se usa para error. Tras este change, los estados de loading/error viven **dentro** de cada sección (no como `SectionFallback` hermano), por lo que `SectionFallback` queda como helper opcional de mensaje; la estabilidad de alto la da el contenedor de swap de cada sección, no el fallback.

## Decisión 3 — `refreshing` ligado al gesto, no a las queries en vuelo

Al mover las queries adentro de las secciones, el shell ya no tiene `hero.isFetching || upcoming.isFetching || movements.isFetching`. La tentación es derivar el indicador de `useIsFetching({ queryKey: ['dashboard'] }) > 0`, pero **es incorrecto**: ese conteo incluye fetches internos de las secciones que comparten el prefijo `['dashboard']` — en particular `['dashboard', 'balance-series', { year, month }]`, que `MonthBalanceSection` dispara al navegar de mes. El resultado es que cada tap en las flechas del navegador mensual enciende el `RefreshControl` superior y, al engancharse programáticamente, empuja el scroll hacia abajo (acumulativo por tap). El componente sigue aislado; el bug está en que el shell observa *todas* las queries del prefijo.

Por eso el `refreshing` se liga al **gesto de pull**, no a queries arbitrarias en vuelo:

```ts
const [refreshing, setRefreshing] = useState(false)
const onRefresh = useCallback(async () => {
  setRefreshing(true)
  try {
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  } finally {
    setRefreshing(false)
  }
}, [queryClient])
```

`invalidateQueries` resuelve cuando los refetches de las queries activas terminan, así que `refreshing` dura exactamente lo que el pull del usuario. Los fetches section-local (navegación de mes) nunca lo tocan. El cableado de invalidación no cambia (sigue invalidando `['dashboard']`, que refresca todas las secciones, cada una con su propio spinner in-card); solo cambia cómo se enciende el booleano. Esto mantiene el shell sin poseer objetos de query de las secciones, que era el punto del refactor.

## Decisión 4 — El eye-mask remount key permanece en el shell

La lógica `useFocusEffect` + `eyeMaskKey` (resetea el `EyeMaskProvider` al salir del tab) es de nivel shell y envuelve todo. Sobrevive intacta: solo se reordena el árbol debajo del provider, no el provider en sí.

## Estado final del shell (referencia, no contrato)

```tsx
export default function DashboardScreen() {
  const today = getTodayAR()
  const refreshing = useIsFetching({ queryKey: ['dashboard'] }) > 0
  // eyeMaskKey + useFocusEffect: sin cambios
  return (
    <EyeMaskProvider key={eyeMaskKey}>
      <View className="flex-1 bg-background">
        <DashboardHeader todayISO={formatDateISO(today)} />
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} … />}>
          <View className="flex-col gap-5">
            <WelcomeFirstMoveCard />
            <HeroSection />
            <UpcomingFortnightSection today={today} />
            <MonthBalanceSection currentYear={…} currentMonth={…} monthsBackLimit={12} />
          </View>
        </ScrollView>
        <QuickAddFab />
      </View>
    </EyeMaskProvider>
  )
}
```

## Riesgos

- **Salto perceptual al cambiar de "todo aparece junto" a "cada sección entra cuando puede".** En teléfono el efecto puede leerse como más "nervioso". Mitigación: el chrome fijo + alto estable hace que solo cambien spinners→datos dentro de cajas que ya ocupan su lugar; no hay reflow. Si en review se prefiere, se puede mantener un esqueleto neutro en vez de spinner por sección — es una decisión de presentación, no de arquitectura.
- **Naming espejo con web.** La spec de `dashboard` exige que los componentes mobile compartan nombre con los web. Absorber queries no cambia los nombres exportados (`HeroSection`, etc.), solo su firma de props; el contrato de naming se mantiene. Las firmas de props "coinciden cuando es técnicamente posible" — y acá divergen a propósito (mobile fetchea internamente), lo cual ya está contemplado por esa spec.
