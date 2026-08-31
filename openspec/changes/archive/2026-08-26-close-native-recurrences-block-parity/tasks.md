> Casi todo el código vive en un archivo; la fase 0 destraba el único token que falta. Las fases están ordenadas por lo que aporta cada una: la 1 arregla el bug de feedback (el motivo del change), la 2 pone la presentación, la 3 cierra. Si hubiera que parar a mitad, después de la 1 el bloque ya deja de desmontarse en silencio.

## 0. El token que falta

- [x] 0.1 En `apps/mobile/lib/colors.ts`, agregar `warning: '#C49A3C'` al objeto `colors`, junto al `warningDeep` que ya está. Es el mirror JS de `--warning` de `@grana/ui-tokens`; la clase de NativeWind (`bg-warning`) ya funciona, sólo faltaba el valor numérico que necesita el `Clock` de lucide en su prop `color`. **No** usar `warningDeep` (#B45309): es naranja quemado y en mobile significa "vencido / por vencer", que es semántica que este change dejó fuera de alcance (ver decisión 3 del `design.md`)

## 1. El feedback después de actuar

- [x] 1.1 En `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx`, cambiar la firma de `onDone` de `() => void` a `(action: 'confirmed' | 'skipped') => void`. `PendingRow` la llama con la acción que corrió al entrar en `if (result.ok)` dentro de `run`. Nada más de la fila cambia
- [x] 1.2 Agregar al bloque el estado `notice: string | null` y un handler que, ante el éxito de una fila, setea la copy correspondiente (`recurrences.pending.confirmed_success` / `.skipped_success`) **y** llama a `invalidateAfterRecurrenceConfirm(queryClient)`. El aviso reemplaza al anterior si el usuario actúa dos veces seguidas
- [x] 1.3 Cambiar la guarda de montaje de `if (instances.length === 0) return null` a `if (instances.length === 0 && !notice) return null`. Ésta es la línea que arregla el bug: entrar vacío sigue devolviendo `null`, quedar vacío habiendo actuado no
- [x] 1.4 Renderizar el banner de éxito cuando `notice` está seteado y el bloque está expandido: `Check` sobre fondo `bg-emerald-soft` con borde `border-emerald/30`, texto `text-emerald-deep` y un `Pressable` de cierre (`X`) que setea `notice` en `null`, con `accessibilityLabel` = `recurrences.pending.close_notice`. Sin temporizador: no se descarta solo
- [x] 1.5 Renderizar la fila `all_clear` cuando la lista está vacía y el bloque está expandido: `Check` + `t('recurrences.pending.all_clear')`, sobre `border-t border-border-soft`
- [x] 1.6 Verificar por lectura que las cinco keys que suma el archivo ya existen en `packages/i18n-messages/src/es.json` **y** `en.json` (`subtitle`, `all_clear`, `confirmed_success`, `skipped_success`, `close_notice`). Cero keys nuevas

## 2. La presentación: card y header colapsable

- [x] 2.1 Reemplazar el contenedor `View className="gap-2"` + label en mayúsculas + count por el anillo + card: un `View` exterior `rounded-2xl bg-warning-bg p-1` y adentro el `Card` de `components/ui/Card.tsx` con `overflow-hidden` y nada más. El anillo es la traducción nativa del halo de 4px de web (RN no tiene `spread` en las sombras) y es lo que carga el acento dorado: **no** teñir el borde del `Card` desde `className` ni pisarle el radio, porque dos utilidades del mismo tipo las resuelve el orden del CSS generado, no el del string (decisiones 1 y 2 del `design.md`)
- [x] 2.2 Montar el header como `Pressable` con `accessibilityRole="button"` y `accessibilityState={{ expanded: isOpen }}`: badge `h-10 w-10 rounded-[13px] bg-warning-bg` con `Clock` en `colors.warning`, bloque de título (`recurrences.pending.title`) + subtítulo (`…pending.subtitle`), pill de count `rounded-full bg-warning-bg text-warning` —oculta con la lista vacía— y `ChevronDown` rotando con `style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}`, el patrón de `components/cards/Wallet.tsx:162`
- [x] 2.3 Agregar el estado de colapso como derivación, no como sincronización: `const [openOverride, setOpenOverride] = useState<boolean | null>(null)` y `const isOpen = openOverride ?? instances.length <= 1`. **No** usar `useEffect` para resetearlo cuando llegan los datos — pisaría la elección del usuario en cada refetch on-focus (decisión 1 del `design.md`)
- [x] 2.4 Envolver el cuerpo (banner, `all_clear` y lista de filas) en `isOpen`, y darle a la primera fila el `border-t border-border-soft` que hoy sólo tienen las filas 2+, para que se separe del header
- [x] 2.5 Importar `Clock`, `ChevronDown`, `Check` y `X` de `lucide-react-native`, y `colors` de `../../lib/colors` para los valores que van por prop (los íconos de lucide toman `color`, no `className`)
- [x] 2.6 Actualizar el comentario de cabecera del bloque: hoy afirma "Renders nothing when there are no pending instances", que después de este change es cierto sólo para el caso de entrar vacío

## 3. Cierre

- [x] 3.1 Verificar por lectura que `getPendingRecurrences`, `confirmRecurrenceInstance`, `skipRecurrenceInstance` e `invalidateAfterRecurrenceConfirm` quedaron **sin tocar**, y que `PendingRow` conserva su badge de compartida, su fecha corta y su monto: el change es de presentación y feedback, no de datos ni de contenido de fila
- [x] 3.2 Verificar que los únicos archivos modificados bajo `apps/` son `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx` y `apps/mobile/lib/colors.ts`
- [x] 3.3 `pnpm typecheck:mobile` y `pnpm lint:mobile` sin errores
- [x] 3.4 `pnpm typecheck` y `pnpm lint` (web) sin errores — no deberían moverse, pero el gate del repo los incluye
- [x] 3.5 Verificación en dispositivo (la corre el usuario, con al menos una recurrencia pendiente): el bloque aparece como card dorada con header; con 2+ arranca colapsado y con 1 abierto; la elección sobrevive salir de la tab y volver; confirmar/omitir deja aviso visible y descartable; vaciar la lista actuando muestra `all_clear` y cerrar el aviso desmonta el bloque; entrar sin pendientes no renderiza nada; comparar la estructura contra `/transactions` en web (el color difiere a propósito)
- [ ] 3.6 Abrir el ticket de seguimiento del `RecurrenceSuggestionBanner`: `onAccept` crea la regla, invalida y termina — no navega a la regla creada ni avisa que salió bien. Es el `SHALL` que el delta dejó a propósito intacto (decisión 5 del `design.md`)
- [x] 3.7 Archivar el change antes del merge: mover a `openspec/changes/archive/YYYY-MM-DD-close-native-recurrences-block-parity/`, aplicar el delta a `openspec/specs/transactions/spec.md` (integrado en el `## Requirements` plano, sin secciones de delta) y correr `pnpm openspec:check`
