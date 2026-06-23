## Context

Paso 3 del rediseño de Compartido, sobre la base de los Pasos 1 (seguridad) y 2 (devengado + bimoneda). El doc de decisiones fija la **cuenta corriente como objeto central**: un libro que corre entre las dos personas, por moneda, con asientos (gasto suma la parte del otro, reintegro/liquidación resta), saldo corriente, estados, y **reversión = contraasiento, nunca borrado**. El handoff (`docs/design/shared/redesign/`) define home, cuenta corriente y saldar (drawer) en alta fidelidad. La deuda ya se deriva por moneda (`householdDebtAt`, `collectDebtInputs`); falta exponerla como libro y cambiar la reversión.

Restricciones (AGENTS.md): saldos **derivados, nunca persistidos**; bimoneda separada; `Money`/`decimal.js`; lógica pura en `money-logic` (mobile la reusa); mobile lo lleva el tech lead (contratos estables, web responsive); online-only (migración a mano).

## Goals / Non-Goals

**Goals:**
- Cuenta corriente nueva: extracto derivado (asientos + "qué cambia" + saldo corriente), ecuación, bimoneda, divisor "hoy" + proyección.
- Reversión por **contraasiento** (preserva historia; el extracto muestra `Revertida` + `Contraasiento`).
- Home rediseñada: neto protagonista (A3), deuda fuera del hero (B8), navegador gobierna solo la actividad (A2), drill conservado.
- Saldar como drawer con montos rápidos (B11) y anotación pedagógica (B10).

**Non-Goals:**
- **No** persistir el saldo ni los asientos (se derivan en cada lectura).
- **No** cambiar el modelo de deuda (impacto) ni el de gasto (devengado, Paso 2).
- **No** romper la guarda B2 (no borrar gasto con liquidación viva): el camino de deshacer es el contraasiento.
- Mobile no es nuestro (solo dejar `money-logic` + contratos listos).

## Decisions

### D1 · El extracto es DERIVADO (función pura en money-logic)

**Decisión:** una función pura nueva en `@grana/money-logic` toma los splits + settlements (con sus fechas) y produce, **por moneda**, la lista cronológica de asientos —cada uno con: fecha, etiqueta del movimiento, **importe firmado** (la parte del otro en lo que pagó cada uno; reintegro/liquidación en negativo), **"qué cambia"** (semántica en castellano: "Suma la parte de Caro" / "Suma tu parte" / "Baja la deuda de Caro" / "Reduce el saldo" / "Restaura el importe"), **estado** (Completada/Pendiente/Revertida/Contraasiento donde aplique) y **saldo corriente**— más los cuatro agregados de la **ecuación** (partes del otro en lo que pagó uno, tus partes en lo que pagó el otro, reintegros+liquidaciones, = saldo). Convención de signo: positivo = a tu favor (el otro te debe).

**Por qué pura:** el saldo es derivado (principio del repo), y mobile reusa la misma derivación. La query (`getCurrentAccount`) solo trae datos (vía `collectDebtInputs`, que ya existe) y delega el armado.

### D2 · "Qué cambia" y el signo salen del tipo de asiento + quién pagó

Gasto que pagó vos → suma la parte del otro (+, a tu favor). Gasto que pagó el otro → suma tu parte (−). Reintegro recibido → reduce la deuda según a quién corresponde. Liquidación que te pagaron → reduce el saldo (−); que pagaste vos → reduce a la inversa. Se deriva, no se guarda texto.

### D3 · Reversión = contraasiento, sin tocar la matemática de deuda

**Decisión:** `reverse_settlement` deja de borrar. En su lugar: (a) marca la liquidación original `reversed` (+ `reversed_at`); (b) inserta el **par de patas opuestas** (settlement-type: `in` en la cuenta del pagador original restaura su saldo, `out` en la del receptor) que anulan el efecto en `disponible`; (c) inserta una **fila `settlement` de contraasiento** (sentido invertido, `reverses_settlement_id` → la original).

**Clave:** la original (reversed) **sigue contando** en la deuda y el contraasiento cuenta en sentido opuesto ⇒ **se cancelan** (neto cero), igual que si no hubiera pasado — sin special-casing en `computeHouseholdBalances`. El estado `reversed` es solo para **mostrar** la línea tachada. Así el extracto preserva la historia y la deuda queda correcta por construcción.

**Alternativa descartada:** marcar la reversed como "no cuenta" y el contraasiento como display-only. Requiere ramas especiales en la derivación; el par que se cancela es más simple y robusto.

### D4 · A2 — el navegador de mes gobierna SOLO la actividad

**Decisión:** el navegador `‹ mes ›` cambia el **gasto del mes y su desglose** (devengado). La **deuda y la proyección** se calculan **a hoy** (`asOf = today`) y **no** dependen del navegador. (Hoy el spec promete que el navegador también mueve la proyección — se corrige.)

**Por qué:** la deuda es una sola, de hoy; la proyección es siempre desde hoy hacia adelante. Mezclarlas con el navegador del gasto confunde dos relojes.

### D5 · A3 — neto protagonista en el hero

El hero pasa a "Gasto del hogar · neto": el **neto** grande (`gastaron − reintegros`), con bruto y reintegros como dato secundario al costado. La **deuda sale del hero** (B8) a una franja/tile propia, fija en "hoy", con accesos Saldar + Cuenta corriente.

### D6 · Saldar como drawer (overlay-primitives)

**Decisión:** saldar pasa de ruta a **`Drawer`** (primitivo de `overlay-primitives`, mismo patrón que el alta de movimiento), disparado desde la home / cuenta corriente. Incluye montos rápidos (Total / parciales, el resto queda en la cuenta corriente — B11), cuenta de origen con saldo, aviso de saldo negativo (Paso 2) y la anotación pedagógica del monto por persona (B10). El flujo posterior (enviado → tarea del receptor → recibo) usa el handshake `settlement` y los estados ya existentes; la pata del receptor sigue siendo `confirm_settlement` (Paso 1).

## Risks / Trade-offs

- **[El contraasiento toca el write-path de liquidaciones (seguridad)]** → Mitigación: se hace en RPC `SECURITY DEFINER` (como el resto del módulo, Paso 1); self-check en la migración; tests estáticos sobre el SQL + QA de reversión con dos usuarios.
- **[La derivación del extracto puede divergir de `householdDebtAt`]** → Mitigación: ambas parten de los mismos inputs (`collectDebtInputs`) y el saldo final del extracto DEBE igualar `householdDebtAt`; test que lo verifica sobre casos testigo.
- **[Paso grande, muchos archivos]** → Mitigación: fases A→D, cada una un commit que compila y testea; el usuario QA al final (pedido explícito). Si una fase crece, se puede partir en su propio change.
- **[Migración de contraasiento sobre datos existentes]** → Mitigación: solo agrega estado/columna y reescribe la RPC; las liquidaciones ya revertidas por el método viejo (borradas) no existen, así que no hay backfill.

## Open Questions

- Presentación fina de la proyección dentro de la cuenta corriente (tramo "lo que se viene") vs la card de la home: el handoff las muestra en ambas; se resuelve en implementación reutilizando `getHouseholdOutlook`.
- Filtros del extracto (Persona / Liquidaciones) del handoff: P2; se puede diferir si la fase A se agranda.
