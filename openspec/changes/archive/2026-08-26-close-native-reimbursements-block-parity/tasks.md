> Todo el código vive en un archivo. Las fases están ordenadas por lo que aporta cada una: la 1 arregla el bug de feedback (el motivo del change), la 2 pone la presentación, la 3 cierra. Si hubiera que parar a mitad, después de la 1 el bloque ya deja de desmontarse en silencio.

## 1. El feedback después de actuar

- [x] 1.1 En `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx`, cambiar la firma de `onDone` de `() => void` a `(action: 'confirmed' | 'cancelled') => void`. `PendingRow` la llama con `'confirmed'` en el éxito de `commit` y con `'cancelled'` en el éxito del `onPress` destructivo del `Alert`. Nada más de la fila cambia
- [x] 1.2 Agregar al bloque el estado `notice: string | null` y un handler que, ante el éxito de una fila, setea la copy correspondiente (`transactions.reimbursement.pending.confirmed_success` / `.cancelled_success`) **y** llama a `invalidateAfterReimbursementMutation(queryClient)`. El aviso reemplaza al anterior si el usuario actúa dos veces seguidas
- [x] 1.3 Cambiar la guarda de montaje de `if (items.length === 0) return null` a `if (items.length === 0 && !notice) return null`. Ésta es la línea que arregla el bug: entrar vacío sigue devolviendo `null`, quedar vacío habiendo actuado no
- [x] 1.4 Renderizar el banner de éxito cuando `notice` está seteado y el bloque está expandido: `Check` sobre fondo `bg-emerald-soft` con borde `border-emerald/30`, texto `text-emerald-deep` y un `Pressable` de cierre (`X`) que setea `notice` en `null`, con `accessibilityLabel` = `…pending.close_notice`. Sin temporizador: no se descarta solo
- [x] 1.5 Renderizar la fila `all_clear` cuando la lista está vacía y el bloque está expandido: `Check` + `t('transactions.reimbursement.pending.all_clear')`, sobre `border-t border-border-soft`
- [x] 1.6 Verificar por lectura que las cinco keys que consume el archivo ya existen en `packages/i18n-messages/src/es.json` **y** `en.json` (`confirmed_success`, `cancelled_success`, `all_clear`, `subtitle`, `close_notice`). Cero keys nuevas

## 2. La presentación: card, header colapsable y chip de categoría

- [x] 2.1 Reemplazar el contenedor `View className="gap-2"` + label en mayúsculas por el anillo + card: un `View` exterior `rounded-2xl bg-slate-soft p-1` y adentro el `Card` de `components/ui/Card.tsx` con `overflow-hidden` y nada más. El anillo es la traducción nativa del halo de 4px de web, que en RN no se puede expresar como sombra (no hay `spread`), y es también lo que carga el acento slate: **no** teñir el borde del `Card` desde `className` ni pisarle el radio, porque dos utilidades del mismo tipo las resuelve el orden del CSS generado, no el del string (ver `design.md`)
- [x] 2.2 Montar el header como `Pressable` con `accessibilityRole="button"` y `accessibilityState={{ expanded: isOpen }}`: badge `h-10 w-10 rounded-[13px] bg-slate-soft` con `Undo2` en `colors.slate`, bloque de título (`…pending.title`) + subtítulo (`…pending.subtitle`), pill de count `rounded-full bg-slate-soft text-slate` —oculta con la lista vacía— y `ChevronDown` rotando con `style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}`, el patrón de `components/cards/Wallet.tsx:162`
- [x] 2.3 Agregar el estado de colapso como derivación, no como sincronización: `const [openOverride, setOpenOverride] = useState<boolean | null>(null)` y `const isOpen = openOverride ?? items.length <= 1`. **No** usar `useEffect` para resetearlo cuando llegan los datos — pisaría la elección del usuario en cada refetch on-focus (ver `design.md`)
- [x] 2.4 Envolver el cuerpo (banner, `all_clear` y lista de filas) en `isOpen`, y darle a la primera fila el `border-t border-border-soft` que hoy sólo tienen las filas 2+, para que se separe del header
- [x] 2.5 En `PendingRow`, agregar el chip de categoría a la izquierda del título: `h-8 w-8 rounded-md` con `backgroundColor` = color de la categoría al 10% (`${item.categoryColor}1A`, con fallback cuando el color viene `null`) y el emoji de `item.categoryIcon` adentro. Renderizarlo **sólo** si `item.categoryIcon` existe
- [x] 2.6 Importar `Undo2`, `ChevronDown`, `Check` y `X` de `lucide-react-native`, y `colors` de `../../lib/colors` para los valores de color que van por prop (los íconos de lucide toman `color`, no `className`)

## 3. Cierre

- [x] 3.1 Verificar por lectura que `getPendingReimbursementsFeed`, `confirmReimbursement`, `cancelReimbursement` e `invalidateAfterReimbursementMutation` quedaron **sin tocar**: el change es de presentación y feedback, no de datos
- [x] 3.2 Verificar que el único archivo modificado bajo `apps/` es `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx`
- [x] 3.3 `pnpm typecheck:mobile` y `pnpm lint:mobile` sin errores
- [x] 3.4 `pnpm typecheck` y `pnpm lint` (web) sin errores — no deberían moverse, pero el gate del repo los incluye
- [x] 3.5 Archivar el change antes del merge: mover a `openspec/changes/archive/YYYY-MM-DD-close-native-reimbursements-block-parity/`, aplicar el delta a `openspec/specs/transactions/spec.md` (integrado en el `## Requirements` plano, sin secciones de delta) y correr `pnpm openspec:check`
