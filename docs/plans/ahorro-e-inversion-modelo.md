# Grana — Ahorro e Inversión: modelo financiero y orden de construcción

> **Estado:** documento de diseño en discusión. No es una spec ni un change de OpenSpec.
> Captura las decisiones tomadas, las que siguen abiertas y el razonamiento detrás,
> para que la discusión sobreviva al chat (principio "el repo es la memoria").
>
> Módulos afectados en `AGENTS.md`: **16 `savings`** (🔲 Planned) y **18 `investments`** (🔜 Future).
> Este documento propone **fusionarlos en un solo modelo** con construcción por etapas.

## 1. Punto de partida: Grana ya resuelve el 40% del problema

Antes de diseñar nada, lo que el ledger actual ya soporta:

| Pieza existente | Qué resuelve del problema de ahorro |
|---|---|
| `transfer` entre cuentas propias | Apartar plata ya se registra bien y **no contamina** "En qué se fue". |
| `exchange` (con `fx_rate`) | El ahorro dolarizado —el más argentino— ya tiene su asiento contable. |
| Categoría `inversiones` (de **ingreso**) con subcategorías *Plazo fijo, Dividendos, Alquileres cobrados, Dólar/MEP* | **Cobrar** un rendimiento ya tiene dónde caer. |
| `adjustment` (movimiento con signo, fechado) | Es la primitiva exacta para "la app cree X, en realidad hay Y". |
| `settlement` (impacta saldo, excluido de analítica) | Precedente de un tipo de movimiento que mueve plata sin ser gasto ni ingreso. |
| Cuentas `credit` fuera de `get_owned_account_ids()` | Precedente de una clase de cuenta con reglas propias que no entra en el disponible. |
| Módulo `guidance` (`user_guidance_events`, `InlineGuide`) | La infraestructura de pedagogía contextual ya está construida. |
| Módulo `recurring-movements` | Sabe **cuándo** cobrás. Es el disparador natural del ahorro. |

**Lo que falta no es "poder guardar plata".** Falta **intención** (¿para qué?), **ubicación explícita** (¿dónde está?), **valuación** (¿cuánto vale hoy?) y **rendimiento** (¿ganó o perdió?).

**El hueco concreto:** constituir un plazo fijo hoy no tiene dónde ir. El usuario lo carga como gasto —muchas veces con la categoría `inversiones`, que ni siquiera es de gasto— y le ensucia la analítica del mes.

## 2. Modelo financiero: una jerarquía, no dos silos

La división anglosajona *savings / investing* no aplica en Argentina: el que compra dólares y los guarda ya está invirtiendo; el que tiene plata rindiendo en una billetera tiene un FCI money market y cree que "tiene plata en la billetera"; el plazo fijo —el instrumento más masivo del país— no busca crecer, busca no perder.

En vez de dos módulos, **una cadena**:

```
DINERO
  ↓  ¿para qué lo quiero?
INTENCIÓN            → meta / reserva / sin destino
  ↓  ¿cuándo lo necesito?
HORIZONTE            → derivado de la fecha objetivo
  ↓  ¿dónde conviene tenerlo?
VEHÍCULO / UBICACIÓN → cuenta (cash, bank, investment) + moneda
  ↓  ¿cómo evolucionó?
VALOR ACTUAL         → valuación fechada
  ↓
PATRIMONIO
```

- **Intención** es blanda, emocional, opcional. Es "el ahorro".
- **Vehículo** es duro, contable, obligatorio. Es "la inversión".
- Un usuario que no sabe de finanzas vive en el primer nivel. Uno que sabe vive en el tercero. Uno avanzado usa toda la cadena.

Esto resuelve *"el usuario puede saber de finanzas como no"* **sin flags de modo** — que además están explícitamente prohibidos en `AGENTS.md` ("Single profile, no user modes"). La profundidad sale del dato, igual que ya pasa con las cuentas.

### Definición canónica

> **Ahorrar = asignar dinero que antes estaba disponible para gastar a un propósito futuro.**

No importa dónde esté: podés ahorrar en pesos, dólares, efectivo, FCI o plazo fijo. Si además ese dinero genera rendimiento, `ahorro + rendimiento → patrimonio`.

## 3. Las tres situaciones — y el gap que es el producto

El apartado resta del disponible. Pero hay tres casos distintos, y Grana los distingue **casi gratis**:

| Situación | Cómo sale del disponible | Costo de implementación |
|---|---|---|
| Aparté y **moví** la plata (plazo fijo, FCI, USD en otra cuenta) | Sale sola: una cuenta `investment` no entra en `get_owned_account_ids()` | Un valor de enum |
| Aparté y **no moví** nada (sigue en la Billetera) | Asignación explícita que resta en la misma función SQL | Tabla nueva + término en SQL |
| **La distancia entre ambas** | — | **Esto es el diferencial** |

> 🇯🇵 Japón — $780.000 apartados
> Están en tu Billetera. No rinden hace 4 meses.

Ninguna app del mercado dice esto. Es el puente natural de ahorro → inversión sin construir un módulo de inversión completo, y es pedagogía sobre **hechos propios del usuario**, no consejo financiero.

### Regla de contención regulatoria

**Grana describe hechos sobre TU plata; no recomienda instrumentos.**

- ✅ "Tenés $2.000.000 sin rendir hace 4 meses." → hecho derivado de sus datos.
- ❌ "Poné eso en un FCI money market." → recomendación de instrumento.

La primera es segura y casi igual de potente. Esta regla debe quedar escrita en la spec del módulo.

## 4. Impacto sobre los invariantes del repo

Lo más importante de este documento: **qué se toca y qué no.**

| Invariante | ¿Se toca? | Cómo |
|---|---|---|
| **Saldos derivados, nunca persistidos** | **NO** | La valuación manual se registra como un **movimiento fechado**, no como una columna `current_value`. El saldo sigue siendo `initial_balance + Σ transactions`. El rendimiento del período **es la suma de las valuaciones**; aportes y retiros son `transfer` y no lo contaminan. |
| **Bimoneda: nunca convertir** | **Excepción acotada** | Únicamente en la vista **Patrimonio**, con cotización elegida por el usuario, fechada y visible. ARS primario, USD subordinado (`$12.450.000 ARS ≈ USD 10.200`). Es una capa de *reporting*, nunca una mutación del ledger. El resto de la app queda intacto. |
| **`disponible` = cash+bank activos, definido una sola vez en SQL** | **SÍ** | Se agrega el término de apartados **en `get_account_balance_sums`**, nunca en TS. `investment` **no** se agrega a `get_owned_account_ids()`. |
| **Corte temporal (el futuro no es un hecho)** | **NO** | Apartados y valuaciones son hechos fechados y se cortan con la misma regla. |
| **`adjustment` cuenta como ingreso/gasto en analítica** | **SÍ (nuevo tipo)** | La valuación necesita quedar fuera de "De dónde vino" / "En qué se fue". Se resuelve con un `transaction_type` propio, siguiendo el patrón de `settlement`. |
| Tarjetas off-ledger · `Money`/`decimal.js` · fechas contables · orden determinístico | **NO** | Sin cambios. |

### Deltas de schema (propuesta)

```
account_type          += 'investment'
transaction_type      += 'valuation'      -- foto de valor, excluido de analítica
accounts.investment_kind (nullable)        -- plazo_fijo | fci | acciones_cedears | cripto | otro
                                           -- solo branding y copy, NO lógica de negocio

savings_goal          (id, user_id, name, icon, kind: 'meta'|'reserva',
                       target_amount NULL, target_currency, target_date NULL,
                       archived_at, created_at)

savings_allocation    (id, user_id, goal_id NULL, currency_code, amount, date,
                       account_id NULL, created_at)
                       -- con signo: apartar (+) / liberar (−)
                       -- lo apartado por meta = Σ allocations. Nunca persistido como total.
```

Todo con RLS por `user_id`, como el resto del esquema.

## 5. Los dos journeys sobre la arquitectura real

### A. Cobré → ahorro primero → disponible para gastar

1. Entra el ingreso (normalmente al **confirmar una instancia de recurrencia** — el sueldo ya es una recurrencia).
2. Grana ofrece apartar según la regla configurada ("10%" o "$200.000").
3. El usuario elige meta, o "Sin destino".
4. Se crea la `savings_allocation`. El hero baja; el "guardado" sube al lado.
5. **Nudge diferido** (no en el mismo momento): "esos $200.000 están en tu Billetera sin rendir". Si el usuario mueve la plata, es un `transfer` común a una cuenta `investment`/`bank`, y la asignación se re-ancla a esa cuenta.

En la card **Balance del mes** (que ya existe con ingresos/gastos/ajustes) aparece el cuarto término: **Apartaste $200.000 · 10%**. Ese es el lugar de la tasa de ahorro — es una métrica de **flujo del mes**.

> **No va en el hero.** El "Para gastar · hoy" es un **stock** (suma de saldos con corte temporal), no "ingresos − ahorro". Mezclarlos introduce un presupuesto mensual estilo YNAB que compite con el modelo de saldos que Grana ya tiene.

### B. Gasté → me sobró → excedente a ahorro

- **Dispara en un borde, no de forma continua.** "Te sobraron $180.000" el día 12 del mes no significa nada: el corte temporal dice que el futuro no es un hecho, y todavía falta pagar el alquiler. Proyectar el excedente requiere el módulo 17 (`cashflow`), que está en Future.
- Bordes válidos con lo que ya existe: **fin de mes**, o **al confirmar el próximo ingreso recurrente**. El segundo es mejor: engancha B con A en un solo momento.
- Se apoya en Balance del mes, que ya está construido.

### Ingreso extraordinario (aguinaldo)

Detectable con datos que Grana ya tiene: un `income` que **no** pertenece a ninguna recurrencia y supera en ~1,5× al ingreso recurrente conocido — o directamente junio y diciembre. Ofrece destinar, y explica por qué un ingreso extraordinario es la oportunidad de subir la tasa de ahorro sin tocar el presupuesto habitual. Alto impacto, bajo costo, muy argentino. **No en el MVP 1.**

## 6. Orden de construcción

### MVP 1 — "Aprender a ahorrar"
- `savings_goal` + `savings_allocation` (apartar / liberar / asignar a meta).
- `account_type += 'investment'` **sin valuación**: le da una casa real al plazo fijo, a los dólares y al FCI. Barato, y hace que "¿dónde está?" no sea una etiqueta de texto.
- El apartado resta del disponible; el "guardado" queda **siempre visible al lado**, reversible en un tap.
- "Apartaste · X%" como cuarto término de Balance del mes.
- Regla de ahorro al cobrar (journey A) y excedente en el borde (journey B).
- Progreso por meta + el señalamiento del gap intención↔vehículo.

### MVP 2 — "¿Cuánto tengo y cuánto rindió?"
- `transaction_type += 'valuation'`: foto manual periódica, fechada.
- Rendimiento por período = Σ valuaciones. Serie histórica de valor.
- Ingreso extraordinario / aguinaldo.

### MVP 3 — Patrimonio
- Vista consolidada, ARS primario + USD de referencia, cotización del usuario fechada.
- Rendimiento real (vs inflación, vs dólar). Grana ya guarda `fx_rate_to_ars` en operaciones del propio usuario: hay semilla para derivar "tu dólar" sin API externa.

## 7. Qué NO tocar

- El hero "Para gastar · hoy" no se convierte en un presupuesto mensual.
- El sistema de sobres estilo YNAB (zero-based budgeting) **no** es el modelo. Es, como mucho, un modo opcional futuro. Apartar pesos que se licúan no es ahorrar; en Argentina el ahorro se expresa en **el vehículo**, no en el monto en pesos.
- No se agregan flags de modo novato/experto.
- No se persisten saldos ni totales derivados.
- No hay integración con brokers ni credenciales de terceros. La foto manual no es una limitación disculpada: es cómo el argentino ya lleva sus inversiones (el Excel). El competidor real en inversión **es una planilla**, y se le gana con menos fricción, no con más features.

## 8. Decisiones abiertas

1. **¿La cuenta remunerada de billetera es `bank` o `investment`?** Es el caso más masivo y el más ambiguo: líquida como una caja de ahorro, pero rinde. Voto: sigue siendo `bank` (el interés entra como `income` categoría Inversiones); si no, la mitad del disponible del usuario se muda a "inversiones".
2. **¿Un plazo fijo es una cuenta o un movimiento con vencimiento?** Una cuenta por cada plazo fijo de 30 días acumula basura; una sola cuenta "Plazo fijo Galicia" con aportes/retiros es más limpia pero pierde el vencimiento, que es dato accionable ("vence el jueves").
3. **¿La unidad de la meta es plata o "cosa"?** "Viaje: USD 1.200" vs "Fondo de emergencia: 6 meses de gastos" — la segunda Grana la puede calcular sola, porque ya conoce los gastos del usuario. Nadie la hace bien en el mercado local.
4. **¿Retiro parcial con ganancia se separa en capital + rendimiento?** El criterio contable dice que sí; la usabilidad dice que nadie lo va a hacer. Con el modelo de valuaciones se deriva solo — falta confirmar que alcanza.
5. **¿Cripto/USDT entra en el MVP?** Casi la mitad de los argentinos ve a las stablecoins como alternativa de ahorro, y en menores de 40 es masivo. Con `investment_kind` entra sin costo adicional.
6. **¿Bienes no financieros (auto, departamento) entran en patrimonio?**
7. **¿`shared` toca ahorros?** Un fondo común de pareja es un caso obvio y el módulo ya tiene lectura cruzada entre usuarios. Puede quedar fuera de scope, pero conviene decidirlo ahora para no cerrar la puerta en el schema.
8. **¿La regla de ahorro al cobrar la ejecuta Grana o solo la sugiere?** Grana no mueve plata real: "automático" acá significa "asiento automático", con riesgo de divergencia contra el banco. Sugerir + confirmar es lo coherente con el pilar de confianza contable.

## 9. Posicionamiento

| Producto | Promesa |
|---|---|
| Spendee | Entendé dónde se fue tu plata. |
| Mobills | Organizá tu presupuesto. |
| YNAB | Dale un trabajo a cada peso. |
| Wallet | Conocé y gestioná tu patrimonio. |
| **Grana** | **Aprendé a tomar mejores decisiones con tu dinero.** |

Coherente con el tercer pilar del producto ("pedagogía sin condescendencia") y con la regla de contención regulatoria de la sección 3: la educación financiera es **parte del producto**, no una sección de consejos que nadie abre.

## 10. Contexto de mercado (agosto 2026)

- Las dos opciones masivas son **cuenta remunerada en billetera (18–27% TNA)** y **plazo fijo a 30 días**. La conducta dominante es el *"ahorro mixto"*: una parte líquida en la billetera para el mes, el excedente a plazo fijo. Es el caso base, no un caso avanzado.
- **Casi la mitad de los argentinos ve a las stablecoins como alternativa de ahorro**; USDT funciona como dólar paralelo digital, sobre todo entre menores de 40.
- Los bancos pagan ~5,5% anual por dólares para captar el "dólar del colchón": hasta el ahorro más conservador se volvió un instrumento con rendimiento.
- YNAB —el origen del sistema de sobres— es caro, está en inglés y **no entiende el dólar paralelo ni la inflación local**. Ese es el hueco.
