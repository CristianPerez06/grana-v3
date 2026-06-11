## Context

`/shared/settings` (web) se implementa hoy en un único client component, `apps/web/app/(app)/shared/settings/_components/settings-form.tsx`, con edición **inline**: el nombre y el reparto por defecto tienen inputs siempre visibles con un botón "OK" por sección. El nuevo handoff (`docs/design/shared-settings/`) reordena la ruta como una vista readonly con drawers enfocados para los campos editables.

Restricciones que enmarcan el diseño:

- No se agregan datos, settings, roles, permisos, queries ni summaries. Todo sale de `getHousehold()`.
- Las mutaciones existentes (`updateHouseholdConfig`, `createInvite`, `leaveHousehold`) y sus contratos (`ActionResult`, `revalidatePath('/shared/settings')`, sin redirect) quedan intactas; la página sigue refrescando con `router.refresh()`.
- La salida del hogar conserva su patrón destructivo actual (`LeaveHouseholdDialog`, bloqueo server-side por deuda viva, redirect a `/shared`).
- La ruta nativa mobile de Compartido no existe; el mock mobile del bundle es referencia responsive/futura, no scope de implementación nativa.

## Goals / Non-Goals

**Goals:**

- Separar lectura de edición: la página muestra valores actuales readonly; nombre y reparto se editan en drawers enfocados.
- Reutilizar el primitivo `Drawer` y `Button`/`Input`/`Label`/`Alert`/`InviteCard` sin cambios de API.
- Mantener idénticas las mutaciones, la derivación `100 - primero` y la validación del split.
- Corregir la jerarquía de color: `Editar` neutro/secundario, verde reservado para `Guardar`, pill `Creador/a` fuera del verde.

**Non-Goals:**

- Implementación mobile nativa (se difiere).
- Drawer para integrantes (readonly), invitación (ya es bloque de acción) o salir del hogar (destructivo → sigue en `Dialog`).
- Variante bottom-sheet del primitivo `Drawer` (no se agrega; ver Decisiones).
- Cambios en `getHousehold()`, en el esquema o en cualquier server action.

## Decisions

**1. Reescritura de `settings-form.tsx` a vista readonly + drawers locales.**
Se mantiene un único client component contenedor que posee el estado de apertura de cada drawer (`nameOpen`, `splitOpen`, `leaveOpen`) y el `error`/`busy` compartido, igual que hoy. Los dos drawers de edición se extraen a componentes locales de la ruta (`_components/name-edit-drawer.tsx`, `_components/default-split-edit-drawer.tsx`), simétricos con el `leave-household-dialog.tsx` ya existente. Alternativa descartada: un único drawer "editar todo" — contradice el diseño de drawers enfocados por campo y complica la mutación parcial.

**2. Cada drawer maneja su propio estado de borrador y dispara la mutación existente.**
El drawer de nombre tiene su `useState(name)` local sembrado del valor actual; el de reparto tiene su `useState(firstPct)` sembrado de `defaultSplit.find(s => s.user_id === members[0].userId)?.percentage ?? 50`, exactamente como hoy. `Guardar` llama al helper `run()` que envuelve `updateHouseholdConfig(...)`, y en éxito cierra el drawer y hace `router.refresh()`. Cancelar/scrim/Esc cierran sin mutar (el `Drawer`/Radix ya da focus-trap, Esc y scrim). Sembrar al abrir evita drift entre el valor mostrado readonly y el borrador.

**3. La derivación del split no cambia.** El drawer edita sólo `members[0]` y arma el payload `[{ user_id: members[0], percentage: firstPct }, { user_id: members[1], percentage: 100 - firstPct }]` — el mismo `saveSplit` actual. El resumen readonly de la página muestra ambos porcentajes derivados del `defaultSplit` almacenado (o 50/50 por defecto), sin tocar la lógica de `money-logic` ni la validación del action.

**4. Se reutiliza el primitivo `Drawer` tal cual (sin bottom-sheet).** `Drawer` es Radix Dialog con `side: 'left' | 'right'` y `max-w-full`; en pantallas angostas el drawer derecho ocupa el ancho completo, lo que da espacio suficiente al formulario. No se agrega una variante bottom-sheet: hacerlo tocaría la spec `overlay-primitives` y ensancharía el scope sin necesidad funcional. El mock mobile usa bottom-sheet como referencia visual; la implementación web acepta el full-width side drawer como equivalente responsive. Alternativa descartada: extender el primitivo a `side: 'bottom'` — se difiere a cuando exista mobile nativo y un consumidor real lo pida.

**5. Recolor del pill de rol como cambio de presentación.** `Creador/a` pasa de `bg-emerald-soft text-emerald-deep` a un tono slate/blue-gray; `Miembro` queda neutro (como hoy). Sin cambio de datos ni de i18n (`creator_badge`/`member_badge` ya existen). Es presentación pura, no necesita scenario de spec.

**6. i18n aditivo con paridad es/en.** No existe `common.edit`; se agregan claves bajo `shared.settings.*` (p. ej. `edit_action`, `name_drawer_title`, `split_drawer_title`, eyebrow `drawer_eyebrow`) en `es.json` y `en.json`. `common.save`/`common.cancel` se reutilizan en el footer del drawer. Se mantiene la paridad de claves que exige la spec de i18n.

## Risks / Trade-offs

- **Romper accidentalmente la mutación parcial del split** → el payload se arma exactamente como el `saveSplit` actual (primer % editado + complemento); no se reordenan miembros ni se persiste el complemento de forma independiente. Verificación visual + typecheck contra el action existente.
- **Drift entre valor readonly y borrador del drawer** → cada drawer siembra su estado al montar desde los datos de `getHousehold()` y se cierra tras `router.refresh()`, de modo que la página readonly siempre refleja lo persistido.
- **Tocar sin querer el flujo de salida** → `LeaveHouseholdDialog` y `leaveHousehold` no se modifican; la sección destructiva sólo cambia de contenedor visual, no de patrón (sigue `Dialog`, no drawer).
- **Mobile sin bottom-sheet** → se acepta el side drawer full-width en narrow como equivalente; si en el futuro mobile nativo necesita bottom-sheet, será un cambio aparte sobre `overlay-primitives`.
- **Paridad de claves i18n** → agregar claves sólo en un catálogo rompería la spec de i18n; se actualizan `es.json` y `en.json` juntos y se verifica la paridad.
