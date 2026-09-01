# Rediseño de la card "Comprometido" (dashboard)

Handoff de diseño para el rediseño de la card **Comprometido** del dashboard.

> **Modelo de lectura vigente.** Este documento es el handoff visual original. El
> modelo de *lectura* de la card —qué ventana mira según el mes seleccionado en el
> navegador— vive en el change `openspec/changes/committed-outlook-follows-month/`.
> `tres-posiciones-del-navegador.html`, en esta misma carpeta, recorre ese modelo con
> un caso concreto: los mismos datos leídos desde el mes actual, el anterior y uno
> más atrás, con el detalle de qué entra, qué queda afuera y por qué.

## Por qué

Dos problemas en producción/UX:

1. **Bug de cálculo:** la card sumaba la deuda `pending` de TODOS los resúmenes de
   tarjeta impagos, incluidos los que vencen meses adelante (cuotas 2..N, períodos
   estimados). Inflaba el número (~2,7× en datos reales). Un fix interino ya acota
   la deuda a "vencido + vence el mes próximo" (branch `fix/dashboard-cards-polish`).
2. **UX/estética:** tiles con íconos cuadrados poco claros, USD inconsistente
   (aparecía en una sección y no en otra ni en el total), y mucho espacio en blanco
   (la card se estira para igualar "Balance del mes").

## Modelo acordado: "obligaciones pendientes"

La card deja de ser "lo del próximo mes" y pasa a responder **"¿qué tengo que pagar
y todavía no pagué?"**, con dos secciones, cada una con sus 3-4 movimientos de mayor
monto para aprovechar el espacio:

- **Resúmenes de tarjeta** — "A pagar" (resúmenes cerrados/vencidos impagos) **+
  "En curso"** (el resumen abierto que acumula) del módulo Tarjetas — todo lo que
  ya debés. Suma pendiente−reintegros sobre resúmenes ya empezados (`start_date <=
  hoy`); EXCLUYE los futuros (`start_date > hoy`: cuotas 2..N), que eran la inflación.
- **Recurrencias · pendientes de confirmar** — instancias `recurrence_instances.status='pending'`
  (`getPendingRecurrenceInstances`). Plata generada que espera tu OK. **NO** se proyectan
  "fijos del próximo mes": una recurrencia, al llegar su momento, se vuelve pendiente de
  confirmar (y si va con tarjeta, su deuda ya está en la sección Tarjeta).

**Total a pagar** = tarjeta a pagar + recurrencias pendientes de confirmar. **USD
consistente** (total + cada sección, bimoneda por defecto). Chip ámbar
"incluye $X vencido" sólo cuando hay deuda vencida.

## Archivos

- `web/comprometido.html` — mockup web aprobado por el usuario (2026-06-22).
- `mobile/comprometido.html` — mockup mobile aprobado (misma estructura, una columna).

El estado "Ya entra" (ingreso recurrente) + banda de cierre neto **se conserva**
(decisión confirmada): aparece sólo cuando hay ingreso recurrente el mes próximo
y NO suma al total a pagar.

## Estado

Modelo y mockups (web + mobile) aprobados. Implementación vía OpenSpec
(`redesign-comprometido-card`), incluye paridad mobile.
