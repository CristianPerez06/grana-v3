# Compartido — Decisiones de rediseño

> Documento de decisiones (no implementación). Captura lo acordado en la exploración
> del módulo Compartido para anclar (a) el prompt de mockups a Claude Design y
> (b) los OpenSpec change proposals que derivan de acá.
>
> **Estado:** decisiones cerradas salvo lo marcado como *(a validar)* o *(presentación
> → mockup)*. Nada de esto está implementado todavía; `openspec/specs/shared/spec.md`
> sigue reflejando el comportamiento actual hasta que cada change se mergee.

## Por qué este documento

El módulo Compartido (web) está implementado y archivado, pero una exploración integral
encontró tres clases de problema que el análisis de la home sola no veía:

1. **Seguridad / integridad cross-user** — es el primer módulo con lectura entre
   usuarios y la frontera de seguridad vive en las server actions, no en la base.
2. **Regresiones contra el baseline v2** (`grana-v2/docs/specs/economia-familiar/`) —
   v3 perdió piezas que v2 ya tenía resueltas (historial de liquidaciones, montos
   rápidos al saldar, anotación pedagógica en el alta).
3. **Inconsistencia de modelo contable** — Compartido usa una base temporal distinta
   a la del resto de la app para "en qué se gastó".

v2 es **evidencia, no destino**: se usa para distinguir problema conocido / solución
ensayada / regresión accidental / cambio deliberado / capacidad nueva. No se copia literal.

## Modelo: Compartido son las tres lentes proyectadas al hogar

Grana ya definió tres lentes, cada una con su propio reloj contable
(ver `openspec/changes/archive/2026-06-18-category-spending-accrual/` y la memoria
`spending-accrual-and-lenses`). Compartido **no inventa un modelo propio**: es esas
mismas tres lentes aplicadas a la pareja.

```
   CONSUMO                      CAJA                       COMPROMISO
   "¿en qué gastamos juntos?"   "¿qué nos debemos hoy?"    "¿qué se viene?"
   base DEVENGADO               base CAJA (impacto)        proyección
   impacta al COMPRAR           impacta cuando             cuotas / resúmenes
   (consumo y cuota por          la plata se mueve          futuros aún no
    fecha + categoría)           de verdad                  impactados
   → "En qué gastaron"          → saldo de la cuenta        → "lo que se viene"
                                   corriente                   en la cuenta corriente
```

### La cuenta corriente como columna vertebral

El objeto central del módulo es una **cuenta corriente entre las dos personas** (idea
del usuario; ya aparece textual en `spending-counts-shared-split`: *"el hogar funciona
como una cuenta corriente"*). Un libro que corre, por moneda, donde:

- cada gasto compartido **suma** la parte del otro,
- cada reintegro y cada liquidación **resta**,
- hay un **saldo que corre**.

```
   CUENTA CORRIENTE — vos y Caro (ARS)
   ───────────── ya impactado · el saldo corre (CAJA) ─────────────
   15/jun  Súper (débito)       parte de Caro    +$9.225   saldo $9.225
   18/jun  Liquidación          Caro te pagó     −$9.225   saldo $0
   ─────────────────── hoy ───────────────────────────────────────
   jul     Cuota 1/3 tarjeta    parte de Caro    +$16.998  (por venir)
   ago     Cuota 2/3 tarjeta    parte de Caro    +$16.998  (por venir)
```

Arriba de "hoy" = ya impactado (saldo actual). Abajo = compromisos por venir (proyección).
**Mismo libro, dos horizontes.** Esto unifica tres superficies que antes estaban sueltas:
historial de liquidaciones + composición de la deuda + estado de cada liquidación.

Consecuencia clave: en una cuenta corriente **no se borra nada**. Una reversión es un
**contraasiento** (una línea que anula otra), nunca un borrado físico. Esto resuelve la
trazabilidad sin imputar pagos a gastos puntuales.

## Los dos relojes (decisión contable central)

Son **distintos a propósito**, igual que CONSUMO vs CAJA en Movimientos:

| Pregunta | Reloj | Regla |
|----------|-------|-------|
| **¿Qué gastamos juntos?** ("En qué gastaron") | **DEVENGADO** | cuenta por **fecha de compra** + categoría; las **cuotas devengan mes a mes** (cada cuota en su mes, para no desdibujar la categoría con el total) |
| **¿Qué nos debemos?** (cuenta corriente) | **IMPACTO / caja** | la deuda nace cuando **la plata se mueve de verdad**: efectivo/débito al instante, tarjeta cuando se paga el resumen, cada cuota en su mes de impacto |

Ejemplo testigo (del usuario): *"gastamos $100 en nafta este mes pero como lo pagamos
con crédito, aún no nos debemos nada"* → el gasto cuenta este mes (devengado), la deuda
es $0 hasta que se pague el resumen (impacto). Correcto bajo este modelo.

**Estado actual vs deseado:**
- **Deuda / cuenta corriente** → ya está en reloj de impacto (`countsByPeriod` por
  vencimiento). **Correcto, no se cambia.**
- **"Gastaron juntos / En qué gastaron"** → hoy está scopeado por **impacto** (el spec
  dice que un consumo de tarjeta que vence el mes próximo no cuenta este mes). **Hay que
  cambiarlo a DEVENGADO** para que Compartido funcione igual que el dashboard y el resto
  de la app. (Matiz: en /shared el gasto muestra el total del hogar —ambas partes—,
  mientras el dashboard muestra solo la parte propia; el *reloj* es el mismo.)

## Decisiones de producto (Parte A)

1. **Membresía inmutable + archivado.** Si un integrante sale, el hogar queda
   **archivado** (solo lectura, nunca se borra, visible para quienes fueron miembros).
   Recién con el hogar archivado se puede crear uno nuevo con otra persona.
   - Archivar/salir **requiere estar al día** (deuda = 0 en todas las monedas).
   - Una pareja nueva = hogar nuevo (id nuevo) ⇒ **nunca** hereda el historial del
     anterior. Esto disuelve por diseño el riesgo de fuga de historial entre parejas.

2. **El navegador de mes gobierna solo la actividad del mes.** Cambia gasto, categorías
   y movimientos del mes. **No** cambia la deuda (es una sola, de hoy) ni la proyección
   (siempre desde hoy hacia adelante). *(Requiere actualizar el spec, que hoy promete que
   el navegador también mueve la proyección.)*

3. **Gasto del mes: el NETO es protagonista.** Mostrar el neto grande y el bruto/reintegros
   como dato informativo al costado/abajo:
   `Costo neto $130.373 · gastaron $145.800, lograron $15.427 en reintegros`.

4. **Cuenta corriente como modelo central** (ver arriba). Deuda en reloj de impacto;
   compromisos futuros como tramo "por venir" del mismo libro.

5. **Permisos simétricos.** Los dos integrantes pueden editar la configuración del hogar
   (nombre, split por defecto). Cada uno edita solo **sus** movimientos (nadie toca los del
   otro). "Creador" no otorga poderes especiales de edición.

6. **Frame = cuenta corriente** (ni cobranza fría ni balance difuso). Voz relacional con
   monto exacto: *"Están casi al día — queda $1.250 a favor de Caro."* La **precisión
   contable no se negocia**; solo se suaviza el tono. *(Presentación exacta → mockup.)*

## Backlog clasificado (Parte B)

Severidad calibrada: no todo "P0" es igual. El único "arreglar ya" de seguridad es la
cadena de invitaciones; el resto es endurecimiento secuenciable.

### 🔴 P0 — Corregir primero (bugs reales)

- **B1. Cadena invite-read → self-insert.** La RLS deja a cualquier usuario logueado
  **listar todas las invitaciones vigentes** del sistema (la política no exige código
  exacto) y **sumarse solo** a un hogar ajeno (la política de insert solo chequea
  `user_id = auth.uid()`). Alcance acotado a hogares en onboarding (con invitación abierta),
  pero es lectura cross-user real. **Arreglar:** invitación legible solo con el código
  exacto; sumarse solo con invitación válida.
- **B2. Borrar gasto compartido → liquidación huérfana.** Borrar cascadea los splits, la
  deuda cambia en silencio y no hay guarda si ya se registró una liquidación. Alcanzable
  por uso normal, sin malicia → **P0 funcional. Arreglar:** avisar antes de borrar y/o
  impedir borrar con liquidación en juego. Bajo cuenta corriente, esto es un contraasiento,
  no un borrado.
- **B3. Bimoneda incompleta.** El desglose por categoría y la proyección solo calculan ARS
  (bug contra el propio spec, que pide "separado por moneda"). **Completar USD** con selector
  ARS/USD.
- **B4. Aviso de saldo negativo ausente al saldar.** Es regla transversal confirmada (toda
  salida cash/bank que deje `disponible < 0` muestra aviso no bloqueante). El form de saldar
  se la saltea. **Agregar** + escribir el scenario en el spec de shared.

### 🟠 P1 — Integridad + UX que importa

- **B5. RLS de settlement demasiado amplia.** Cualquier miembro puede `UPDATE` cualquier
  campo. Amenaza de insider/bug. **Afinar:** el pagador edita mientras está pendiente; el
  receptor solo asigna su cuenta.
- **B6. Crear/confirmar liquidación no es atómico** (multi-write con rollback manual).
  **Pasar a una RPC atómica** (como `reverse_settlement`).
- **B7. Invariantes en la base.** Hoy viven solo en la app: que los splits sumen el total,
  que sus dueños sean miembros, y `un hogar activo por usuario` (encaja con la decisión A1).
  **Llevar a la base.**
- **B8. Sacar la deuda del hero navegable** (decisión A2). Franja propia fija en "hoy".
- **B9. Cuenta corriente / historial de liquidaciones.** **No existe — se arma de cero.**
  Reemplaza y unifica "historial" + "composición de deuda" + "estado de liquidación".
- **B10. Recuperar la anotación pedagógica en el alta** (de v2): preview del **monto** por
  persona + la frase *"el gasto impacta tu saldo; la parte de Caro ($X) se registra como
  deuda a tu favor"*. **Cuidando no recargar.**
- **B11. Montos rápidos al saldar** (de v2): botón "Total" + pago parcial con resto
  registrado.
- **B12. Ecuación bruto − reintegros = neto** (= decisión A3).

### 🟡 P2 — Más adelante / a validar

- **B13. Voz relacional + monto exacto** (= decisión A6).
- **B14. Reintegro retroactivo** *(a validar)*: poder declarar un reintegro sobre un gasto
  compartido ya creado (hoy solo se puede al crearlo).
- **B15. Mobile — NO es nuestro.** `apps/mobile` lo maneja el tech lead. Nuestra parte:
  dejar la **capa compartida y los contratos estables**, y que **todo lo que hagamos en web
  sea responsive**.

### ⚫ Descartes (no hacer)

- **B16. "Carga devengada" como 4º número** — colapsa en la deuda, no agrega una pregunta nueva.
- **B17. Estado "saldado" por gasto individual** — el modelo no imputa pagos a gastos puntuales;
  sería estado inventado. La cuenta corriente da la trazabilidad sin esto.
- **B18. Esconder USD cero** — viola "bimoneda por defecto". Se subordina visualmente, no se esconde.

## Secuencia de OpenSpec changes (sin solapamientos)

1. **Seguridad e integridad** — B1, B2, B5, B6, B7. (Frontera cross-user antes de exponer más.)
2. **Modelo contable + bimoneda** — reloj devengado para el gasto, B3, B4. (Alinear con las
   tres lentes; corregir la bimoneda.)
3. **Cuenta corriente + contrato temporal + UI** — B8, B9, B10, B11, B12, A2, A3. (El rediseño
   visible, sobre base ya estabilizada.)
4. **Validadas con uso** — B13, B14 y cualquier analítica nueva.

Mobile (B15) no es un change nuestro; se respeta dejando contratos estables y web responsive.

## Principio de implementación

Compartido toca dinero entre dos personas: la implementación en la app debe ser **muy
explicativa**. Cada cifra debe poder responder "¿de dónde sale?" (la cuenta corriente lo
hace por construcción), y los momentos sensibles (saldar, borrar, dividir, el desfasaje
gasto-devengado vs deuda-impacto) necesitan microcopy que enseñe el modelo, en línea con
el pilar de confianza contable de Grana.

## Cuestiones de presentación abiertas (para el mockup)

- Cuenta corriente: ¿tramo "por venir" mezclado en la misma lista (con línea "hoy") o sección
  aparte abajo?
- Cómo se muestra el frame relacional (A6) sin perder el monto exacto.
- Anotación pedagógica del alta (B10): cómo darle lugar sin recargar el formulario.
- Layout de las tres lentes en la home: ¿bloques apilados con identidad visual fuerte, o tabs?

## Fuentes

- `openspec/specs/shared/spec.md` — comportamiento actual.
- `openspec/changes/archive/2026-06-18-category-spending-accrual/` — modelo de tres lentes + devengado.
- `openspec/changes/archive/2026-06-18-spending-counts-shared-split/` — hogar = cuenta corriente, parte por miembro.
- `supabase/migrations/0023_shared.sql` — RLS y constraints auditados (B1, B5, B7).
- `grana-v2/docs/specs/economia-familiar/` — baseline de diseño (mockups dashboard/history/settle/toggle/settings).
</content>
</invoke>
