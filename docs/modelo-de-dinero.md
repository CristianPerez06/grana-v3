# El modelo de dinero de Grana

> Modelo conceptual de producto. **No es una spec ni un change de OpenSpec** — es la capa de
> pensamiento que va antes, y la referencia para decidir dónde vive cada pieza nueva.
>
> Complementa `docs/grana-en-una-pagina.md` (qué es Grana hoy) y precede a los changes que
> incorporen ahorro, propósito, posiciones y valor.
>
> Sustituye al borrador `docs/plans/ahorro-e-inversion-modelo.md`, que quedó desactualizado.

---

## 1. La cadena

```
DINERO
  │  ¿puedo gastarlo hoy?
  ↓
DISPONIBLE ──────────── derivado de la posición
  │  ¿decido no gastarlo?
  ↓
GUARDAR ──────────────── decisión del usuario
  │  ¿para qué?  (opcional)
  ↓
ASIGNAR ──────────────── decisión del usuario
  │  ¿dónde está?
  ↓
POSICIÓN ─────────────── hecho
  │  ¿cuánto vale?
  ↓
VALOR ────────────────── hecho
  │  agrupado por propósito
  ↓
META ─────────────────── vista
```

Ningún usuario recorre la cadena entera. Cada escalón es opcional y aparece cuando hace falta.
Grana ya tiene resueltos **Disponible** y **Posición**.

**Ahorro** e **inversión** no son escalones: son **resultados**. Ahorrar es ejercer *Guardar*.
Invertir es una propiedad de la *Posición* donde quedó esa plata. Por eso no son dos módulos.

---

## 2. Las cuatro naturalezas

Todo lo que el modelo toca cae en una de estas cuatro. **Saber en cuál cae decide dónde vive,
qué reglas tiene y quién lo puede cambiar.** Es el criterio para admitir cualquier pieza futura.

### ① Hechos del ledger — *qué le pasó a la plata*

Los siete tipos de movimiento que ya existen. Se registran, no se opinan.

- Pueden ser incómodos: un saldo negativo es un hecho válido.
- Tienen fecha contable y se cortan a hoy.
- Los saldos se derivan de ellos y **nunca se persisten**.
- Candidato futuro a sumarse acá: la **valuación** ("hoy esto vale $X"), que es un hecho fechado.

### ② Decisiones del usuario — *qué decidió sobre la plata*

**Guardar / liberar. Asignar / desasignar.**

- **No son movimientos.** No mueven plata: cambian su función.
- **No entran al ledger.** Grana nunca inventa un movimiento financiero para representar una intención.
- **No admiten ser inválidas.** Guardar más de lo que tenés no es un estado incómodo: es un input erróneo.
- Son **reversibles** por definición.
- Se derivan de sus entradas; el total guardado nunca se persiste.

### ③ Atributos de las posiciones — *cómo es el lugar donde está la plata*

Propiedades de la cuenta o del vehículo, no de la plata ni del usuario.

- ¿Participa del disponible?
- ¿Está inmovilizada, y hasta cuándo?
- ¿Genera renta, o su valor fluctúa?
- ¿En qué moneda vive?

### ④ Capas de lectura — *cómo se mira todo lo anterior*

No agregan datos: reinterpretan los que ya hay.

- La **vara** (pesos corrientes, dólares, poder de compra).
- Las **agrupaciones** (por vehículo, por propósito, por disponibilidad).
- El **horizonte** derivado de compromisos, metas y gasto histórico.
- La **meta**, que agrupa asignaciones y no contiene plata.

> **Regla de admisión:** una pieza nueva que no cae limpio en una de las cuatro está mal planteada.

---

## 3. Los dos verbos

| | **Guardar** *(⇄ Liberar)* | **Asignar** *(⇄ Desasignar)* |
|---|---|---|
| Qué hace | Saca un monto del disponible | Le da un propósito a un monto |
| Opera sobre | Plata que **hoy está** en el disponible | **Cualquier** plata, esté dentro o fuera del disponible |
| Tope | El disponible. No puede excederlo | El monto de esa posición |
| Efecto en el disponible | **Lo reduce** | **Ninguno** |
| Efecto en el ledger | Ninguno | Ninguno |
| Obligatorio | No | No |
| Por moneda | Sí, siempre | Sí, siempre |

**Cómo se combinan:**

- *Guardar sin asignar* → válido, y es **el caso normal**. "Guardé $200.000, todavía no sé para qué."
- *Asignar sin guardar* → válido cuando la plata **ya está fuera** del disponible. Los $500.000 del
  plazo fijo no se guardan (ya no son disponibles): se **asignan** a Japón.
- *Guardar y asignar juntos* → una sola acción de cara al usuario.

**En la interfaz son dos conceptos y una sola acción**, cuando la plata está en el disponible:
*Guardar $200.000* → *¿para qué?* (con "todavía no sé" como respuesta legítima). Asignar existe por
separado solo para la plata que ya está afuera.

---

## 4. Reglas del modelo

1. **Guardar no mueve plata: cambia su función.** No hay transferencia bancaria detrás.
2. **Ninguna decisión del usuario entra al ledger.** El ledger registra hechos; las decisiones viven aparte.
3. **Lo guardado se deriva de sus entradas.** Nunca se persiste un total, igual que los saldos.
4. **Guardar se topea al disponible.** El ledger admite negativos porque registra hechos; una decisión imposible no es un hecho incómodo, es un error.
5. **Todo por moneda.** Nunca existe un guardado ni una meta en un total mezclado ARS+USD.
6. **Las decisiones tienen fecha** y se cortan a hoy como todo lo demás.
7. **Una meta no contiene plata: agrupa asignaciones**, que pueden estar en distintas cuentas y monedas.
8. **El propósito es opcional.** Única excepción prevista: el **fondo de emergencia**, que Grana necesita conocer explícitamente porque es indistinguible de "plata sin destino" y exige lo contrario (liquidez por encima de rendimiento).
9. **Grana describe hechos sobre la plata del usuario; no recomienda instrumentos.** "Tenés $2.000.000 sin rendir hace cuatro meses" es un hecho. "Poné eso en un FCI" es asesoramiento.
10. **Lo que Grana no puede saber, lo declara.** Un diagnóstico sobre información parcial puede ser peor que ningún diagnóstico.

---

## 5. Fases

Cada fase se sostiene sola y prepara la siguiente. Ninguna obliga a deshacer la anterior.

| Fase | Qué agrega | Qué habilita |
|---|---|---|
| **1 · Guardar** | El verbo, y que una cuenta pueda no participar del disponible | "De lo que tengo, esto no lo voy a gastar" · Cuentas pasa a responder cuánto hay fuera del circuito diario (plazo fijo, FCI, USD guardados) |
| **2 · Propósito** | Asignar, y la meta como vista | "Esto es para Japón" · una meta respaldada por varias posiciones y monedas |
| **3 · Valor** | Valuación fechada por posición | "Cuánto tengo hoy acá" y "cuánto rindió" |
| **4 · Vara y patrimonio** | Total consolidado con cotización del usuario, poder de compra | "Cuánto tengo en total" y "cuánto gané de verdad" |
| **Transversal** | Horizonte derivado + señal de adecuación | "Esta plata la necesitás el 5 y está inmovilizada hasta el 15" |

Las fases 1 y 2 no requieren ningún dato externo. La 4 sí (inflación, cotizaciones).

---

## 6. Lo que la fase 1 aprovecha sin construir

- `transfer` y `exchange` ya existen y ya están fuera de la analítica de gastos.
- **Cuentas** ya es, en la práctica, la vista de "lo que tengo": solo le falta agrupar por si la
  cuenta participa del disponible.
- El corte temporal, la bimoneda, el aviso no bloqueante y los primitivos de overlay ya están hechos.
- El ledger, las reglas de signo y la analítica del mes **no se tocan**.

---

## 7. Lo que queda abierto

1. **El nombre del verbo.** El modelo lo llama *reserva*. En la UI, "Guardar" es lo que dice un argentino; "Apartar" es la alternativa; "Reservar" suena a reservar una mesa.
2. **¿Un guardado se ancla a una cuenta o es por moneda a secas?** Por moneda es más simple y no cierra puertas; anclarlo permite decir "esos $200.000 están en tu Billetera sin rendir", pero reintroduce la imputación de retiros parciales.
3. **Prorrateo entre asignaciones** cuando una posición compartida cambia de valor o sufre un retiro parcial. Es de fase 3, pero conviene no cerrar la puerta antes.
4. **Tratamiento del fondo de emergencia** como propósito con reglas propias (tamaño derivable del gasto mensual; liquidez por encima de rendimiento).
5. **Qué hace Grana con el drift** de las cuentas que rinden solas, hoy leído como "plata movida sin registrar" — una alarma que se enciende justo cuando al usuario le fue bien.
