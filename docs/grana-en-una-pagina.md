# Grana, en una página

> Documento de contexto para conversaciones de producto **fuera del repo** (con otra IA, con un diseñador,
> con alguien que se suma). Describe **qué es Grana, qué tiene andando hoy y cómo funciona por dentro**,
> a nivel macro y sin detalle de implementación.
>
> No reemplaza a `AGENTS.md` (que son las instrucciones operativas para trabajar el repo). Es su versión
> corta y orientada a producto. **Está pensado para pegarse entero en un chat.**
>
> Última actualización: agosto 2026.

---

## 1. Qué es

App de finanzas personales para el mercado argentino, hecha por un contador para gente que necesita
control real en un entorno bimonetario (ARS + USD). Web (Next.js) + mobile nativo (Expo), con paridad
funcional entre las dos.

**Tres pilares:**

1. **Confianza contable** — los números son correctos y no hay nada escondido.
2. **Personalidad propia** — no es un banco ni una planilla.
3. **Pedagogía sin condescendencia** — la app sugiere y enseña, nunca trata al usuario de tonto.

**Diferenciales:** las cuotas de tarjeta como ciudadano de primera; la vida cotidiana bimoneda
(el argentino ahorra en dólares y gasta en las dos); el contexto inflacionario.

**Un solo perfil de usuario, sin modos.** No existe un flag `novato`/`experto`. La profundidad sale
del dato, no de una configuración: quien tiene una sola cuenta ve la experiencia simple (la dimensión
"cuenta" ni aparece); quien crea más cuentas hace aparecer la pregunta "¿dónde está exactamente esa plata?".

---

## 2. Cómo está armado

- **Monorepo** con dos apps: `apps/web` (Next.js App Router) y `apps/mobile` (Expo).
- **Dos implementaciones nativas, una sola API.** El JSX no se comparte entre web y React Native;
  la paridad se garantiza con **tipos de props compartidos**. La lógica de negocio pura (saldos,
  fechas, recurrencias) vive en paquetes compartidos.
- **Backend: Supabase (Postgres) online.** No hay instancia local. Las migraciones SQL ordenadas
  **son la verdad del schema** — no hay un `schema.sql` de referencia.
- **RLS (Row Level Security) es la frontera de autorización**, no el código de la app.
- **Spec-driven:** cada cambio de negocio se escribe primero como spec (OpenSpec) y se archiva antes
  de mergear. El principio fundacional del proyecto es **"el repo es la memoria"**: una IA sin
  contexto de chat tiene que poder continuar el producto leyendo el repo.

---

## 3. El modelo de datos, en criollo

### Cuentas
Una cuenta es donde está la plata. Tres tipos: **`cash`** (efectivo), **`bank`** (banco/débito) y
**`credit`** (tarjeta de crédito). Una cuenta agrupa saldos **por moneda** (ARS y USD, ambas activas
por defecto para todo usuario).

### Movimientos
Hay **siete tipos** de movimiento, y la distinción entre ellos es el corazón del modelo:

| Tipo | Qué es | ¿Cuenta como gasto/ingreso? |
|---|---|---|
| `income` | Entra plata al patrimonio | Ingreso |
| `expense` | Sale plata del patrimonio | Gasto |
| `transfer` | Se mueve entre cuentas propias | **No** — la plata sigue siendo tuya |
| `exchange` | Cambio de moneda ARS↔USD, con cotización | **No** |
| `adjustment` | Corrección con signo ("la app dice X, en realidad hay Y") | Sí (según el signo) |
| `reimbursement` | Reintegro/cashback, atado al gasto que lo originó | No es ingreso |
| `settlement` | Liquidación de deuda entre miembros de un hogar | **No** — mueve saldo, no es gasto |

**Consecuencia clave: mover plata entre bolsillos propios ya está bien modelado y no ensucia la
analítica.** Comprar dólares es un `exchange`, no un gasto. Pasar plata de una cuenta a otra es un
`transfer`, no un gasto.

### Tarjetas de crédito
Modeladas de verdad, no como una cuenta más: **períodos (resúmenes) con cuatro fechas**, consumos,
cuotas en pesos (una fila madre + N hijas), pago del resumen y reversión del pago.

### Recurrencias
Plantillas (el sueldo, el alquiler, Netflix) que generan instancias con fecha. El usuario las
**confirma, saltea o pospone**. Grana sabe cuándo cobrás y cuándo pagás.

### Compartido
Hogar de dos personas, gasto compartido con split por porcentaje, deuda **derivada** por moneda,
y liquidación. Es el único caso de lectura cruzada entre usuarios.

---

## 4. Los invariantes duros

Esto no es "cómo está hecho hoy": es **lo que hace que los números sean verdad**. Romper cualquiera
de estos no produce otra UI, produce plata mal contada en silencio. Varios existen porque ya falló.

| Invariante | Qué significa |
|---|---|
| **Saldos derivados** | No existe ninguna columna de saldo. Todo saldo se calcula desde el historial de movimientos, siempre. Nunca se persiste. |
| **Agregación completa por construcción** | Toda lectura cuyo producto sea un número de plata se agrega en SQL o se pagina exhaustivamente. Traer filas y sumarlas en el cliente ya produjo un saldo plausible y mal. |
| **Bimoneda: nunca convertir** | ARS y USD son dos libros separados. Nunca se suman ni se convierten automáticamente. ARS es siempre el primario (tipografía grande), USD el subordinado. Los totales van siempre por moneda. |
| **El futuro no es un hecho** | Un movimiento con fecha posterior a hoy existe y se ve en las listas, pero **nunca** entra en un número que responda "cuánto tengo" o "cuánto gasté". El corte es al día de hoy, en zona horaria argentina. |
| **Tarjetas off-ledger** | Un consumo con tarjeta **no** reduce tu disponible. Solo lo hace el pago del resumen. |
| **Una sola definición, en SQL** | El criterio de "qué cuentas forman el disponible" vive en **una única función de Postgres**. Copiarlo a mano ya causó una divergencia real en producción. |
| **Saldo negativo permitido, con aviso** | El disponible **puede** quedar negativo: refleja la realidad. Ninguna operación lo bloquea ni lo recorta. Se avisa sin bloquear. |
| **Fechas contables** | Las fechas financieras son fechas contables sin hora. "Hoy" se calcula siempre en la zona horaria financiera del usuario (Argentina), nunca con el reloj del servidor (que corre en UTC y correría el corte tres horas). |
| **Plata con decimales exactos** | Toda aritmética monetaria usa un tipo `Money` con decimales exactos. Nunca aritmética de punto flotante. |

---

## 5. Qué hay andando hoy

**Pantallas que existen** (web y mobile, con paridad salvo donde se aclara):

| Pantalla | Qué responde |
|---|---|
| **Inicio** (dashboard) | "Para gastar · hoy" (ARS + USD) y **dónde está** esa plata (cuentas) · **Balance del mes** (ingresos / gastos / ajustes) · **En qué se fue** (dona por categoría) · selector de mes |
| **Cuentas** | Lista de cuentas agrupadas, con saldo por moneda; detalle de cuenta con su historial |
| **Tarjetas** | Tarjetas, resúmenes, consumos, cuotas, pago de resumen |
| **Movimientos** | El ledger completo, con filtros y búsqueda; alta/edición de movimientos; recurrencias |
| **Compartido** | Hogar, deuda derivada, cuenta corriente, liquidación |
| **Configuración** | Categorías propias, preferencias, idioma |

**Módulos terminados:** auth, perfiles, categorías (18 del sistema + propias, con subcategorías
argentinas), cuentas, movimientos, tarjetas, recurrencias, dashboard, onboarding, shells de web y
mobile, ajustes, gasto por categoría, compartido *(compartido solo en web por ahora)*.

**Existe además un módulo de guías contextuales** (`guidance`): un sistema de hints inline que se
muestran una vez, se pueden descartar, y quedan registrados por usuario. Es la infraestructura de
pedagogía, ya construida y hoy poco usada.

---

## 6. Qué NO existe

- **Ahorro / metas / propósito.** No hay forma de decir "esta plata no la voy a gastar". Está planificado, sin diseñar.
- **Inversiones.** No hay tipo de cuenta para un plazo fijo, un FCI, CEDEARs o cripto. **Se pueden cargar hoy como cuentas comunes, pero entonces inflan el "para gastar".**
- **Valuación / rendimiento.** Ninguna posición tiene valor de mercado ni rendimiento calculado.
- **Patrimonio consolidado.** No hay una vista de "cuánto tengo en total".
- **Proyección de flujo de caja.** Los compromisos **ciertos** (resúmenes, recurrencias, cuotas) sí se conocen con fecha; lo que no existe es la estimación del gasto variable futuro.
- **Datos externos de mercado.** Ni cotizaciones, ni inflación, ni precios. Grana no consulta ninguna API financiera. La única cotización que conoce es la que el propio usuario cargó en sus operaciones.
- **Integración bancaria.** No hay sincronización con bancos ni brokers, y no está planeada. Todo se carga a mano.

---

## 7. Cosas que un análisis externo suele asumir mal

Estas son correcciones frecuentes cuando alguien opina sobre Grana sin haber leído el código:

1. **"Grana no tiene forma de apartar plata."** La tiene a medias: `transfer` entre cuentas propias ya existe y ya está excluido de la analítica de gastos. Lo que falta es la **intención**, no el movimiento.
2. **"Hay que agregar un tipo de movimiento para comprar dólares."** Ya existe (`exchange`, con cotización).
3. **"El 'Para gastar hoy' es ingresos menos gastos del mes."** No: es un **stock** — la suma de los saldos de las cuentas propias, cortado al día de hoy. El flujo del mes es otra card distinta ("Balance del mes").
4. **"Comprometido se resta del disponible."** No. Es una mirada al **futuro** (resúmenes y recurrentes que vienen), no un descuento sobre el saldo de hoy. Restarlos mezclaría presente con futuro.
5. **"Los dólares no cuentan en el disponible."** Sí cuentan. La disponibilidad **no depende de la moneda**: USD en una cuenta o billetera que usás son disponibles; USD en una caja de seguridad no lo son porque están fuera del circuito cotidiano, no por ser dólares.
6. **"Se puede mostrar el patrimonio total en pesos."** Hoy no: el invariante bimoneda lo prohíbe en el ledger. Cualquier total único requiere una decisión explícita de producto y una cotización elegida por el usuario, como capa de *reporting*.
7. **"Grana puede calcular el rendimiento de cualquier cuenta."** No de una cuenta de uso diario: si el rendimiento y los gastos ocurren sobre el mismo saldo, el rendimiento solo es derivable si el registro de movimientos está **completo**, y en una cuenta que se usa todos los días nunca lo está.
8. **"Un ajuste es un error del usuario."** Puede serlo, pero también puede ser una corrección legítima. Hoy la app no distingue el motivo, y eso hace que el semáforo de ajustes tenga falsos positivos.
9. **"Se pueden agregar modos novato/experto."** No. Está explícitamente prohibido: hubo un flag así y se eliminó.

---

## 8. Vocabulario

Para que las conversaciones no se crucen:

- **Disponible / "Para gastar hoy"** — suma de los saldos de las cuentas propias (efectivo y banco, activas), por moneda, cortada al día de hoy.
- **Comprometido** — obligaciones futuras conocidas: resúmenes de tarjeta que vencen y gastos recurrentes que vienen. Es una mirada hacia adelante, no un descuento.
- **Cuenta propia** — efectivo o banco, activa. Las de crédito quedan afuera por el invariante off-ledger.
- **Off-ledger** — que no toca el disponible. Es como funcionan las tarjetas de crédito.
- **Corte temporal** — la regla de que nada con fecha futura entra en un número del presente.
- **Ledger** — el registro de movimientos. La verdad de qué pasó con la plata.
