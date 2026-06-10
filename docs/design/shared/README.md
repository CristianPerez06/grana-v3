# Propuesta visual `/shared`

## Contexto

Esta propuesta aplica `docs/design/route-ui-system.md` a la ruta root `/shared`. El alcance es solo la home de Compartido; no incluye `/shared/setup`, `/shared/settle` ni `/shared/settings`, aunque la home renderiza el formulario de setup cuando no existe hogar.

La ruta mobile nativa de Compartido no existe hoy. El mock mobile de este bundle es referencia de paridad futura, no scope de implementacion inmediata.

## Implementacion inspeccionada

- `apps/web/app/(app)/shared/(home)/layout.tsx`
- `apps/web/app/(app)/shared/(home)/page.tsx`
- `apps/web/app/(app)/shared/(home)/loading.tsx`
- `apps/web/app/(app)/shared/_components/invite-card.tsx`
- `apps/web/app/(app)/shared/_components/pending-settlement-card.tsx`
- `apps/web/app/(app)/shared/setup/_components/setup-form.tsx`
- `apps/web/lib/shared/queries.ts`

## Datos disponibles

- Nombre del hogar o titulo default `shared.title`.
- Accion textual a `/shared/settings` cuando existe hogar.
- Estado sin hogar: descripcion de setup, selector crear/unirse, nombre del hogar o codigo de invitacion, submit.
- Estado esperando segundo miembro: titulo, hint, generacion de codigo, copiar, WhatsApp y compartir nativo.
- Estado activo:
  - miembros del hogar y nombre del par.
  - deuda derivada por moneda ARS/USD, separada por moneda.
  - estado saldado.
  - CTA a `/shared/settle` solo cuando el usuario debe algo.
  - liquidaciones pendientes recibidas: monto, moneda, nombre de quien pago, selector de cuenta receptora, confirmar.
  - gastos/reintegros compartidos recientes: descripcion o categoria, pagador, participacion propia, monto total, moneda, signo positivo para reintegro.
- Loading: card de balance y filas recientes.

## Direccion propuesta

- Ampliar la ruta desde `max-w-lg` a un ancho cercano a `960px` cuando el hogar esta activo.
- Mantener `PageHeader` simple: nombre del hogar y link de configuracion.
- Usar un balance hero para la deuda por moneda. ARS va arriba y con mayor jerarquia; USD queda subordinado. Nunca se fusionan monedas.
- Usar una columna lateral solo para datos/acciones existentes: miembro/par, liquidaciones pendientes, invitacion si corresponde.
- Mantener recientes como lista operativa, no como feed editorial.
- En mobile, apilar: header, balance, tareas pendientes, recientes.
- Cubrir explicitamente los tres estados root: setup, esperando miembro, hogar activo.

## Recomendaciones

- La ruta activa puede beneficiarse de un wrapper condicional: setup puede seguir estrecho, hogar activo puede usar `max-w-[960px]`.
- No agregar totales, conteos o metricas nuevas.
- `PendingSettlementCard`, `InviteCard` y `SetupForm` ya usan `Button`; conservar eso.
- El monto de deuda debe seguir derivado de `getHouseholdDebt`; no persistir ni recalcular en UI.
- Si se implementa mobile nativo de Compartido, requiere trabajo de producto/paridad separado.

## Archivos del bundle

- `shared.css`
- `web/shared.html`
- `mobile/shared.html`
- `components/route-shell.html`
- `components/setup-state.html`
- `components/waiting-member-state.html`
- `components/balance-card.html`
- `components/pending-settlement-card.html`
- `components/recent-shared-list.html`
- `components/invite-card.html`
- `components/loading-state.html`
- `components/empty-state.html`
