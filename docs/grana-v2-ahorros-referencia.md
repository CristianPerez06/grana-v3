# Grana V2 — el modelo de Ahorro e Inversión, como referencia

> Extracto del repo **privado** `CristianPerez06/grana-v2` (`docs/specs/ahorros/`), para poder discutir
> el modelo de posiciones/instrumentos fuera de este repo sin dar acceso al código.
>
> **No es para copiar.** V3 tomó decisiones distintas en varios puntos, y al final del documento se
> listan las divergencias que importan. Sirve para rescatar el modelado del **plazo fijo** y de las
> **posiciones financieras**, que es donde V2 llegó más lejos.

---

## 1. Cómo V2 modela una cuenta

Dos dimensiones **ortogonales**:

| Dimensión | Valores | Qué expresa |
|---|---|---|
| `type` (técnico) | `cash` · `debit` · `credit` · `investment` | Qué es la cuenta |
| `funcion` (declarada por el usuario) | `operativa` · `ahorro` · `mixta` | Para qué la usa |

- **`operativa`** — para gastar. Aporta al disponible, no participa del pool de ahorros.
- **`ahorro`** — para no tocar. No aporta al disponible.
- **`mixta`** — las dos cosas a la vez (el caso Mercado Pago). Aporta al disponible, y solo la porción imputada a un sobre se descuenta.

Existe como migración real (`020-accounts-funcion.sql`), con backfill: `is_savings=true` → `ahorro`;
`type='investment'` → `ahorro`; el resto → `operativa`.

**La razón de la decisión**, textual: *"la propiedad 'esta cuenta es para gastar o para ahorrar' la tiene que declarar el usuario, no Grana por el `type`"*, porque ningún criterio automático sirve para los tres perfiles argentinos (monocuenta en billetera / bancario con PF y FCI / avanzado con broker).

### Fórmula del disponible

```
disponible(usuario, moneda) =
    Σ saldo(C, moneda)  para C con funcion ∈ ('operativa','mixta')
  − Σ asignaciones a sobres ancladas a cuentas 'mixta'
```

Las asignaciones ancladas a cuentas `ahorro` puras **no descuentan nada**, porque esa plata nunca
estuvo en el disponible. Es la corrección que motivó pasar el modelo de sobres a M:N: cada
asignación lleva `account_id`, así la fórmula discrimina sin inventar una regla de imputación.

---

## 2. Cómo V2 modela un instrumento (lo que nos interesa)

### Decisión 11 — alcance de instrumentos

> V1 soporta tres subtipos de cuenta `investment`:
> - **Plazo fijo** — saldo + **TNA** + **fecha de vencimiento**
> - **FCI** (Money Market, Renta Fija, Mixta, Variable) — valuado al **VCP del día** informado por el broker
> - **Crypto** — **unidades** + cotización del día
>
> Se posponen: bonos soberanos, CEDEARs, acciones, ONs, letras, cauciones.

**El motivo de posponerlos es la parte importante:**

> *"Todos estos requieren modelar 'posiciones dentro de una cuenta comitente' — gap descubierto en Test 1."*

Y el gap, textual:

> ❌ **GAP DESCUBIERTO:** cuentas comitente con múltiples posiciones internas (4 instrumentos en 1 Cocos)
> NO están modeladas. **El concepto "una cuenta `investment` = un instrumento" no escala a cuentas comitente.**

O sea: **V2 se hizo exactamente la pregunta "¿la cuenta alcanza como unidad?" y la respondió así** —
alcanza para plazo fijo, FCI y cripto (porque el banco/broker los expone como cuentas separadas), y
se rompe recién con el broker que tiene varias posiciones adentro.

El detalle del instrumento vivía en una tabla propia, **`instrument_details`**, explícitamente
diferida a Fase 2. Nunca se construyó.

### Decisión 12 — el rescate hace la matemática solo

> Las **pérdidas** realizadas se modelan como `adjustment` negativo con categoría del sistema
> "Pérdidas de capital" (`is_capital_loss = true`).
> Las **ganancias** son `income` con categoría "Rendimientos" (`is_capital_gain = true`).

Flujo al rescatar, **invisible para el usuario**:

1. Pregunta cuánto recibió (ej. $480.000)
2. Compara contra el costo registrado (ej. $500.000)
3. Diferencia positiva → `income` "Rendimientos"
4. Diferencia negativa → `adjustment` negativo "Pérdida de capital"
5. Genera la `transfer` del instrumento a la cuenta destino por el monto real

> *"El usuario nunca ve la palabra adjustment. Solo registra 'vendí el FCI, me dieron $X'."*

### Decisión 8 — los rendimientos son ingresos, pero en un plano aparte

Se registran como `income` con categoría "Rendimientos", **con un flag** que los excluye de toda
métrica de "tasa de ahorro" o "ingreso operativo". Siguen disparando el hook al ingreso.

### Decisión 9 — instrumentos al costo

El saldo de una cuenta `investment` se calcula con la fórmula estándar del motor
(`initial_balance + transacciones`). Para capturar valor de mercado, el usuario crea
**`investment_snapshots`** manualmente. Los snapshots **no participan del disponible ni de los sobres**,
solo de reportes. La ganancia impacta el disponible **solo cuando se realiza**.

*(La tabla `investment_snapshots` existía en el schema de V2 desde antes y nunca se usó.)*

---

## 3. El modelo de sobres (contexto)

- Un **sobre** es una entidad propia: nombre, moneda inmutable (ARS o USD), objetivo opcional de monto y/o fecha, auto-split opcional. **Saldo derivado**, nunca persistido.
- Las **asignaciones** son M:N y llevan `account_id`: un sobre puede tener plata en varias cuentas, y una cuenta puede cubrir varios sobres.
- El mecanismo principal de aporte es el **hook al ingreso**: cada vez que entra plata, la app pregunta si quiere reservar algo. *"El ahorro es consecuencia del ingreso, no obligación del calendario."*
- Un sobre **sin objetivo funciona perfecto**; con monto y fecha, calcula aporte sugerido.

---

## 4. Divergencias con V3 — leer antes de reusar nada

| Tema | V2 | V3 |
|---|---|---|
| **Saldo negativo** | Invariante **duro** `disponible ≥ 0`: la app **bloquea** el gasto. Para gastar del sobre hay que desasignar explícitamente | **Permitido, con aviso no bloqueante.** V3 lo revirtió a propósito (el invariante `I-AH-1` de V2 está explícitamente derogado en `AGENTS.md`) |
| **Tipos de cuenta** | `cash · debit · credit · investment` + `funcion` de 3 estados | `cash · bank · credit`. No existe `investment` |
| **Cotización en cambio de moneda** | Derivada, no editable | `exchange` con `fx_rate` |
| **Pérdidas de capital** | `adjustment` negativo con categoría flagueada | V3 no tiene el concepto |
| **Nombre del módulo** | "Ahorros" en F1 → muta a "Ahorro e Inversión" en F2 | Sin definir |

**La divergencia del saldo negativo es la más grande**: todo el diseño de sobres de V2 se apoya en que
la app no te deja gastar el ahorro sin desasignar primero. V3 decidió lo contrario —mostrar la
realidad y avisar—, así que ese flujo **no se puede levantar tal cual**.

---

## 5. Lo que vale la pena rescatar

1. **El instrumento tiene propiedades propias** y no son un atributo más de la cuenta: plazo fijo = capital + TNA + vencimiento; FCI = VCP; cripto = unidades.
2. **`instrument_details` como tabla aparte** es el punto de extensión correcto: hoy 1:1 con la cuenta, mañana 1:N cuando aparezca el broker con varias posiciones. Nada que deshacer.
3. **El rescate calcula solo** y el usuario nunca ve vocabulario contable.
4. **Los rendimientos son ingresos con flag**, para que no inflen la tasa de ahorro.
5. **La función de cuenta la declara el usuario**, no se infiere del tipo — porque ningún criterio automático cubre los tres perfiles.
6. **El gap del comitente está identificado y acotado**: la cuenta alcanza como unidad hasta que aparecen varias posiciones adentro de una sola.
