# El modelo de dinero de Grana

> Modelo conceptual de producto. **No es una spec ni un change de OpenSpec** — es la capa de
> pensamiento que va antes, y la referencia para decidir dónde vive cada pieza nueva.
>
> Complementa `docs/grana-en-una-pagina.md` (qué es Grana hoy) y precede a los changes que
> incorporen ahorro, propósito, posiciones y valor.
>
> Sustituye al borrador `docs/plans/ahorro-e-inversion-modelo.md`, que quedó desactualizado.

---

## 1. Las dimensiones

El dinero **no recorre pasos**. En todo momento está en un lugar, con ciertos atributos, y sobre él
ocurren hechos o decisiones que los cambian. Modelarlo como una secuencia sugiere una dependencia
que no existe: una meta puede existir sin valuación, una posición sin propósito, un propósito sin
inversión.

```
                                 DINERO
                                   │
        ┌───────────────┬──────────┴──────────┬───────────────┐
        ↓               ↓                     ↓               ↓
    POSICIÓN          VALOR            DISPONIBILIDAD      PROPÓSITO
  ¿dónde está?    ¿cuánto vale?        ¿puedo gastarlo?     ¿para qué?
      hecho           hecho                derivada          decisión
     siempre         siempre               siempre           OPCIONAL
```

**Lo que las cambia**

| | Cambia |
|---|---|
| **Hechos** — los movimientos del ledger | Posición y valor |
| **Decisiones** — guardar/liberar, asignar/desasignar | Disponibilidad y propósito |

**Lo que las interpreta, sin cambiarlas**

La **vara** (pesos, dólares, poder de compra) · el **horizonte** (derivado de compromisos, metas y
gasto histórico) · las **agrupaciones** (por vehículo, por propósito, por disponibilidad) · la **meta**,
que agrupa asignaciones y no contiene plata.

### La disponibilidad tiene dos fuentes independientes

Es la dimensión sobre la que se apoya toda la fase 1, y no se deriva de una sola cosa:

- **La posición** — esta cuenta no participa del disponible (un plazo fijo, la caja de seguridad).
- **La decisión** — guardé este monto de una cuenta que sí participa.

Ninguna implica la otra. **Guardar produce plata no disponible, pero no toda la plata no disponible
fue guardada**: un FCI puede estar fuera del circuito diario sin que el usuario lo haya "guardado",
y puede ser patrimonio de largo plazo sin ningún propósito declarado.

### Ahorro e inversión no son dimensiones

Son **resultados** de ejercer las otras:

- **Ahorrar** = ejercer una decisión (*guardar*) sobre plata disponible.
- **Invertir** = una propiedad de la **posición** donde esa plata quedó.

Por eso nunca fueron dos módulos, y por eso mover plata de una caja de ahorro a un FCI no es
"pasar de ahorro a inversión": es la misma plata cambiando de posición.

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
| Ojo | Es **una** de las dos fuentes de no-disponibilidad, no la única (ver §1) | No dice nada sobre la disponibilidad |
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
8. **El propósito es opcional, y cuando existe tiene un tipo.** No hace falta una primitiva aparte para el fondo de emergencia: es un **tipo de propósito** (`objetivo` con monto y fecha · `reserva` sin fecha pero con necesidad de liquidez · sin definir). Lo que sí es propio de la reserva de emergencia es que Grana **no la puede inferir**: sin que el usuario lo diga, es indistinguible de "plata sin destino", y exige exactamente lo contrario (liquidez por encima de rendimiento).
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
