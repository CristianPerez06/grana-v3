# Exploración — Instrumentos, o dónde está parada la plata

> **Documento exploratorio. No es un change, no propone schema, no propone tablas y no toca nada.**
> Piensa cómo entraría la capa de instrumentos dentro de «Ahorro e inversión» sin romper Guardado ni
> Propósitos. Primero producto, modelo y pantallas mínimas; el SQL es de después.
>
> Se apoya en `docs/modelo-de-dinero.md` (canónico) y en el razonamiento contable de
> `docs/design/modelo-de-dinero/fase-3-posiciones.html`. Donde este documento contradiga al modelo,
> gana el modelo — o hay que corregir el modelo primero, en su propio lugar.
>
> **Estado de lo construido:** el módulo `/savings` está implementado en web y en nativa, con QA
> visual nativo bloqueado por acceso. **`extract-savings-module` queda congelado**; nada de acá se
> implementa antes de ese QA.
>
> **Revisión 2 — el orden de fases cambió y el criterio de admisión se afinó.** La primera versión
> proponía empezar por plazo fijo. Producto lo corrigió: se empieza por **FCI / fondos con rescate**.
> Y el criterio dejó de clasificar **por producto** para clasificar **por comportamiento** (§2.1), que
> es lo que hace que un mismo FCI pueda ser cuenta en una billetera y posición en un banco.
>
> ## ⏸ EN PAUSA — esta fase espera a `docs/exploracion-rendimiento-cuentas.md`
>
> **El naming de FCI no se cierra todavía**, y la razón no es de prioridad sino de vocabulario. El caso
> más común del país —una billetera remunerada que rinde sola y se gasta directo— **no entra en esta
> capa** y tampoco tenía pantalla ni ticket. Las dos capas producen «plata que apareció sin que la
> ganaras trabajando», así que si una la llama «Rindió» y la otra «Resultado», el usuario aprende dos
> palabras para la misma idea. **Y hay una colisión concreta: si la línea de una cuenta remunerada dice
> «Rindió», el candidato «En rendimiento» para esta sección compite con ella.** Eso no estaba sobre la
> mesa cuando se comparó A/B/C. Todo lo demás de este documento sigue en pie.
>
> **Revisión 3 — la dirección de FCI v1 quedó cerrada sobre el mock, no sobre este texto.** La sección
> se llama **«En rendimiento»**, que no era ninguno de los tres candidatos que este documento comparó
> (§5.2c). El resultado de un rescate se dice **«Resultado»**, un rótulo para los dos signos, y el
> «pusiste» **nunca va solo**. Todo está dibujado en
> `docs/design/modelo-de-dinero/fase-3a-fci-v1.html`, que es la referencia de la fase; §5.2 y §5.2b se
> conservan como el razonamiento que llevó ahí, no como la recomendación vigente.

---

## Contexto fijo, que este documento no discute

Son las reglas ya decididas. Cualquier idea de acá que las contradiga está mal planteada.

| | |
|---|---|
| **El módulo existe** | «Ahorro e inversión» (`/savings`) ya es la casa de Guardado + Propósitos, en las dos apps |
| **Guardado no es inversión** | Sigue en las cuentas, **no mueve el ledger**, y baja «Para gastar» por una decisión del usuario |
| **Propósitos no son cuentas ni posiciones** | Son **reparto por monto** sobre lo guardado. La plata guardada es fungible |
| **ARS y USD nunca se suman ni se convierten** | Todo por moneda, siempre |
| **USD no es instrumento: es moneda** | Comprar dólares es **cambio de moneda**, no un FCI (§2.4) |
| **Una cuenta usable para pagar es cuenta** | Aunque rinda. Sigue en «Para gastar» |
| **Un FCI es posición solo si requiere una acción previa** para poder gastar esa plata | El criterio es de comportamiento, no de producto |

### Acuerdos cerrados de FCI v1

Firmados por producto. No se vuelven a discutir por texto.

1. **El criterio de admisión es** *¿puedo pagar con esa plata sin hacer nada antes?* Sí → cuenta.
   No → posición.
2. **No se clasifica por nombre de producto.** El mismo money market puede ser cuenta o posición
   según si se usa directo o requiere rescate.
3. **Hay dos altas distintas**: «ya lo tenía» —carga de stock, no toca el mes— y «lo puse hoy» —salida
   de liquidez, movimiento financiero, no gasto—.
4. **El riesgo de duplicar patrimonio es real** y aparece en el mock, con este copy a probar:

   > **«¿El saldo que le cargaste a tu cuenta en Grana ya incluye esta plata?»**
   > · **Sí** → *«Ajustaremos el saldo de tu cuenta para mover esa plata al fondo sin duplicarla.»*
   > · **No** → *«Solo registramos la posición sin tocar tus cuentas.»*

5. **El rescate parcial v1 es simple**: reduce el capital registrado, no fuerza cuotapartes ni VCP, no
   inventa rendimiento parcial, y usa copy honesto —**«pusiste»**, no «tenés»— mientras el valor
   actual no esté confirmado.

6. **La sección se llama «En rendimiento»**, provisoriamente y sobre el mock, no sobre esta tabla
   (§5.2c). «Plata colocada» y «Puesto a trabajar» quedan como alternativas vivas.
7. **El resultado de un rescate se dice «Resultado +$X / −$X»**, un solo rótulo para los dos signos.
   Nada de «Ganaste» ni «Perdiste» — y tampoco «Rendimiento cobrado», que era el candidato preciso
   para el positivo líquido hasta que la sección se quedó con esa palabra.
8. **El «pusiste» nunca va solo.** Donde aparece el capital lo acompañan *«Valor no actualizado
   automáticamente»* y la fecha de la última actualización manual. Es lo que evita que el número
   choque contra lo que el usuario ve en la app del banco.

**Todo lo de arriba está dibujado en `docs/design/modelo-de-dinero/fase-3a-fci-v1.html`**, diecisiete
pantallas. Lo que sigue sin cerrarse es el **verbo del mes** (§5.2c) y todo lo listado en §9.2.

---

## 0. La pregunta, en una línea

Grana hoy contesta **cuánto puedo gastar**. Lo que no contesta es **qué está haciendo el resto**.

Y no es una pregunta de inversores. Un usuario con $2.000.000 en la caja de ahorro y $800.000 en un
fondo no se pregunta cuál fue su rendimiento anualizado: se pregunta cuánto de eso puede tocar si
mañana se le rompe el auto.

El ejemplo no es casual. **El que tiene un plazo fijo ya sabe que esa plata no la puede tocar; el que
tiene plata en un fondo cree que la tiene disponible.** La confusión más común es también la más
usada, y por eso la capa empieza ahí.

---

## 1. Taxonomía de dinero

### 1.1 No son seis cajones: son dos ejes

La lista intuitiva —para gastar, guardado, rescate rápido, bloqueado a fecha, USD, posiciones
variables— parece una taxonomía de seis categorías paralelas. **No lo es.**

**Eje A — Disponibilidad: ¿puedo gastarlo hoy?**

La no-disponibilidad tiene **dos fuentes independientes**, y esta capa tiene que respetarlas sin
colapsarlas:

| Fuente | Qué la produce | Reversible | Ejemplo |
|---|---|---|---|
| **Decisión** | El usuario *guardó* | Sí, de un tap | «Aparté $200.000» |
| **Posición** | La plata **no está** en una cuenta que participe del disponible | Sí, pero con un acto | Un FCI, un plazo fijo |

Ninguna implica la otra. **Guardar produce plata no disponible, pero no toda la plata no disponible
fue guardada.**

**Eje B — Certeza del valor: ¿sé cuánto vale?**

| Grado | Qué significa | Ejemplo |
|---|---|---|
| **Nominal cierto** | Vale lo que dice | Plata en una cuenta |
| **Contractual** | Vale lo que dice un contrato con fecha | Plazo fijo |
| **De mercado** | Vale lo que alguien pague hoy | FCI, CEDEARs, acciones |

**Lo que NO es un eje: la moneda.** En Grana la moneda es dimensión de todo — hay disponible, guardado
y propósitos en pesos y en dólares. Tratar «USD» como una categoría de esta taxonomía es un error de
tipo, y §2.4 lo desarrolla.

### 1.2 El mapa

```
                          ¿PUEDO GASTARLO HOY?
                    sí                        no
                    │                          │
  ┌─────────────────┼──────────────────────────┼──────────────────┐
  │  NOMINAL        │  Para gastar             │  Guardado        │
  │  CIERTO         │  (cuentas, en su moneda) │  (decisión)      │
  │                 │  ← también las que rinden│                  │
  │  CONTRACTUAL    │  —                       │  Plazo fijo      │
  │                 │                          │  (posición)      │
  │                 │                          │                  │
  │  DE MERCADO     │  —                       │  FCI · CEDEARs   │
  │                 │                          │  (posición)      │
  └─────────────────┴──────────────────────────┴──────────────────┘
       ↑ ledger: hechos            ↑ decisión          ↑ posición: un lugar
```

Tres lecturas que conviene fijar:

1. **La fila de arriba es todo lo que Grana hace hoy.** Las dos de abajo son esta capa entera.
2. **La columna izquierda no tiene instrumentos, y es correcto.** Lo que se puede gastar hoy sin
   ningún acto previo **no es un instrumento: es una cuenta**, rinda o no rinda.
3. **«Guardado» y «posición» comparten columna pero no naturaleza.** Uno es una decisión reversible de
   un tap; el otro es plata que físicamente no está. Colapsarlos en una línea —«fuera de lo
   disponible»— cierra la aritmética y le miente al usuario, que deja de saber cuánto puede recuperar
   hoy.

### 1.3 «Rescate rápido» y «bloqueado a fecha» no son dos entidades

Son **el mismo tipo de cosa con distinta liquidez**. Diseñarlos como dos entidades duplicaría el alta,
la valuación y el rescate para no ganar nada.

| Liquidez | Qué significa para el usuario | Ejemplos |
|---|---|---|
| **Con rescate** | Lo tenés cuando lo pidas — hoy, mañana o en dos días | FCI money market, FCI de renta fija |
| **Bloqueado a fecha** | Lo tenés el día que vence | Plazo fijo tradicional, UVA |
| **Valuación variable** | Lo tenés cuando vendas, y no sabés a cuánto | CEDEARs, acciones |

Estos tres nombres reaparecen en §5.3 como **estados internos de una fila**, no como nombres de
sección. La distinción importa y es de las cosas útiles que salieron de esta vuelta.

---

## 2. Qué entra y qué no

### 2.1 El criterio de admisión: por comportamiento, no por producto

> **¿Puedo pagar con esa plata sin hacer nada antes?**
>
> - **Sí** → es una **cuenta**. Vive en «Para gastar», en su moneda. Aunque rinda.
> - **No** → es una **posición**. Sale del disponible, y ese «algo antes» es su rescate.

**Y esto es lo importante: el criterio NO clasifica por producto.** Un mismo nombre comercial puede
caer de los dos lados según cómo funcione en la práctica:

| Caso real | Veredicto | Por qué |
|---|---|---|
| Saldo remunerado de Mercado Pago, **usable directo** con QR y tarjeta | **Cuenta / Para gastar** | Pagás sin hacer nada antes. Que rinda es un atributo, no un cambio de naturaleza |
| **FCI bancario que hay que rescatar** antes de poder usar | **Posición** | Hay un acto previo, y sin él la plata no está en ninguna cuenta |
| **FCI T+1 / T+2 en un broker** | **Posición** | Ídem, y encima con demora |
| **FCI T+0** que igual exige pedir el rescate | **Posición** | El acto previo existe aunque tarde cero |

La formulación exacta de la pregunta importa, porque hay dos y solo una sirve:

- ❌ *«¿esto es líquido?»* — Sí, en el sentido financiero. Y así planteada empuja a meterlo en el
  disponible.
- ✅ *«¿Grana puede decir que esta plata se puede gastar hoy?»* — Si hace falta un rescate, **no**. La
  tarjeta no se debita de ahí y la transferencia no sale de ahí.

**Rescatable en el día no es lo mismo que gastable hoy**, y esa distinción es la que hace que «Para
gastar» signifique algo.

> **Corrección respecto de la revisión 1.** Ese documento decía «la cuenta remunerada es cuenta» y
> «el FCI money market es posición» como reglas **de producto**. Con productos que se mueven —las
> billeteras cambiaron dos veces en dos años cómo funciona su saldo remunerado— una regla por producto
> envejece mal y obliga a revisarla con cada lanzamiento. La regla por comportamiento no: la contesta
> el usuario, que es el que sabe si puede pagar o no.

### 2.2 Consecuencia: quién clasifica

Si el criterio es de comportamiento, **Grana no puede deducirlo del nombre del fondo**. Dos caminos:

- **Que lo declare el usuario**, en el alta, con una pregunta en su idioma: *«¿podés pagar con esta
  plata directamente, o primero tenés que rescatarla?»*
- **Que lo deduzca la app** por el producto — descartado por el párrafo de arriba.

**Propuesto: lo declara el usuario.** Y probablemente ni siquiera como pregunta explícita, sino por la
puerta que eligió: quien entra por «tengo un fondo» ya contestó que hay rescate. La pregunta explícita
queda como respaldo para el caso ambiguo.

### 2.3 Caso por caso

| Caso | Veredicto | Fase |
|---|---|---|
| Cuenta remunerada usable para pagar | **Cuenta** | Ya funciona |
| USD en cuenta o en efectivo | **Cuenta, en otra moneda** | Ya funciona |
| **FCI / fondo con rescate** | **Posición, con rescate** | **3A** |
| Plazo fijo tradicional o UVA | Posición, bloqueado a fecha | 3B |
| CEDEARs, acciones, bonos | Posición, valuación variable | 3C |
| Cripto | **Fuera** | — |

**Cripto queda fuera** y no por prejuicio: por costo. Valuación 24/7, custodia propia vs. exchange, y
una fiscalidad que el usuario espera que la app entienda. Nada de eso mejora la pregunta de liquidez
que abre esta capa.

**Tampoco entran** las deudas que no son tarjeta —un préstamo es lo simétrico de una posición, y es
otra capa— ni los bienes: el auto y el departamento son patrimonio, no plata, y no tienen liquidez ni
rescate.

### 2.4 USD, aclarado para que no se mezcle

Es la confusión más fácil de esta capa, así que queda escrita entera:

- **Tener dólares no es tener un instrumento.** Es tener plata en otra moneda, y Grana ya es bimoneda
  de punta a punta.
- **Comprar dólares es cambio de moneda.** Es un hecho, ya existe en el ledger como `exchange`, con su
  `fx_rate`. **No es un gasto** y **no es un FCI**.
- **Modelar «dólares» como posición crearía una tercera representación de la misma plata** —cuenta,
  moneda, posición— y las tres tendrían que reconciliar entre sí.
- **La excepción, que no es excepción:** un activo dolarizado específico —un FCI en dólares, un bono—
  sí es una posición. Pero lo es **por ser un fondo o un bono**, no por estar en dólares. La moneda es
  un atributo de la posición, igual que lo es de una cuenta.

Regla corta: **la moneda dice en qué está expresada la plata; la posición dice dónde está.** Son
preguntas distintas y ninguna reemplaza a la otra.

---

## 3. Impacto contable

### 3.1 Qué mueve el ledger y qué no

| Acto | ¿Toca el ledger? | Por qué |
|---|---|---|
| **Guardar / volver a usar** | No | Es una decisión: cambia la función de la plata, no su lugar |
| **Destinar / quitar destino** | No | Ídem |
| **Suscribir: poner plata en un fondo** | **Sí** | La plata **sale de la cuenta**. El saldo baja de verdad |
| **Rescatar** | **Sí** | La plata vuelve a la cuenta |
| **Cargar una posición que ya existía** | **No** (§6.1) | No pasó nada hoy. Es stock preexistente |
| **Que la posición cambie de valor** | **No** | No pasó nada en ninguna cuenta |

Esta tabla es lo que hace que la capa **no rompa** lo construido: guardar y destinar siguen sin tocar
el ledger, y las posiciones lo tocan porque efectivamente mueven plata. Dos naturalezas distintas,
cada una haciendo lo suyo.

### 3.2 Lo que no puede contaminarse

**Ni «Gasto» ni «Ingreso».** Es la regla dura, y tiene dos caras:

- **Poner $700.000 en un fondo no es un gasto.** Como `expense`, la card diría que gastaste $905.433
  en un mes en que gastaste $205.433 — y ese número alimenta la tira de ritmo, la comparación con el
  mes pasado y «En qué se fue». *El error no queda ahí: se propaga.*
- **Que vuelvan $380.000 no es un ingreso.** Metería en «Entró» plata que nunca fue sueldo, y la mayor
  parte son **los mismos pesos que salieron**, contados dos veces.

Dos salidas tentadoras, las dos descartadas:

- **Una sola línea «Fuera de lo disponible»** que junte guardado y posiciones. Cierra la aritmética y
  colapsa una decisión reversible con plata que hay que ir a buscar. El usuario que ve un solo número
  **no sabe cuánto puede recuperar hoy**.
- **No poner ninguna línea** — la peor, porque no se nota. La identidad de la card se despeja
  (`Tenías = disponible − (entró − se fué − guardado)`), así que cualquier plata que salga sin término
  propio la absorbe «Tenías» en silencio: **la suma da y el pasado queda reescrito**. Una suma que no
  cierra el usuario la puede agarrar; un pasado reescrito no.

### 3.3 Stock y flujo

|  | **Guardado** | **La línea nueva** |
|---|---|---|
| Naturaleza | **Stock** — una postura de hoy | **Flujo** — algo que pasó en un mes |
| ¿Saca plata de las cuentas? | No | **Sí** |
| Término en la card | El stock **entero** | Solo **lo del mes** |
| En un mes cerrado | **No se dibuja** | **Se queda para siempre** |

Guardar no saca plata de las cuentas, así que el saldo de apertura del mes todavía la contiene y hay
que restarla completa. Suscribir **sí** la saca: lo que salió en julio ya no está en el saldo de
apertura de agosto, y restar el stock lo contaría dos veces.

Que sea flujo es lo que la hace **pertenecer a su mes**. Por eso la card puede ganar esta línea sin
romperse: no compite con «Guardado», hace lo contrario.

### 3.4 De dónde sale el valor, que es lo que FCI-primero obliga a contestar

El plazo fijo tenía una ventaja que el fondo **no tiene**: el contrato da los números. Un FCI sube
todos los días y nadie le dice a la app cuánto.

| Respuesta posible | Qué implica | |
|---|---|---|
| Cotización automática | Integración y un número que se mueve solo | Fuera del recorte y de lo que Grana es |
| Rendimiento estimado | Grana calculando una tasa | **Prohibido**: inventar un número sobre plata ajena |
| **Vale lo que pusiste, hasta que el usuario diga otra cosa** | Un dato opcional que nadie le exige | **Propuesto** |

La tercera parece pobre y no lo es, por una razón que solo se ve mirando el ciclo completo:

> **Con el FCI, la verdad no llega con la valuación: llega con el rescate.**

Cuando el usuario rescata, sabe **exactamente** cuánto volvió — se lo dice el banco, no Grana. Y ahí,
contra el capital registrado, la diferencia queda determinada sin haber estimado nada.

O sea: **la fase 3A entrega el circuito contable completo sin construir la capa de valuación.**

La actualización manual del valor queda **opcional y puntual**: sirve para que el bloque no mienta a
los seis meses, no para calcular nada. Y mientras no la haya, la pantalla lo dice — *«vale lo que
pusiste»*— en vez de dejarlo implícito (regla 11 del modelo: *lo que Grana no puede saber, lo
declara*).

### 3.5 Resultado realizado: ni sueldo ni gasto

Cuando se cierra la posición:

```
   monto que volvió  −  capital registrado pendiente  =  resultado realizado
```

- **Positivo** → rendimiento financiero realizado. **No es `income`**: no es sueldo, no entra a «Entró»
  y no alimenta la tira de ritmo.
- **Negativo** → pérdida financiera realizada. **No es `expense`**: no gastaste nada.
- **En los dos casos explica una variación de liquidez**, y por eso necesita término propio.

Con FCI money market la pérdida es **rara pero posible** —comisiones, un día malo— y el circuito tiene
que soportarla desde el día uno aunque casi nunca se vea. Un circuito que solo maneja el caso feliz se
descubre roto el peor día.

### 3.6 El drift, que esta capa agrava

Las cuentas que rinden solas producen **drift**: el saldo real se aleja del calculado sin que el
usuario registre nada.

> **Corrección.** Una versión anterior de esta sección decía que Grana «hoy lo lee como plata movida sin
> registrar — una alarma que se enciende justo cuando al usuario le fue bien». **Es falso y no había
> sido verificado contra el código.** No existe ninguna alarma, ninguna detección y ningún aviso: el
> saldo calculado queda por debajo del real y **Grana se queda callada**. Lo único que existe es el
> tipo de movimiento `adjustment` («Ajuste»), que el usuario crea **a mano** cuando ya se dio cuenta
> solo. El problema no es apagar una alarma molesta: es encender algo que no existe.

Ya estaba abierto en el modelo, y más plata rindiendo es más drift. **Y resultó ser más grande que esta
capa**: le pasa a cualquiera con una billetera remunerada, que es el caso más común del país y **no
entra acá** —una cuenta usable para pagar es cuenta, no posición—. Tiene documento propio:
`docs/exploracion-rendimiento-cuentas.md`, y **va antes que esta fase**.

---

## 4. Relación con propósitos

### 4.1 El error que no hay que repetir

La fase 2 ya aprendió esto y costó una migración: **el propósito no se le cuelga a una fila**. Su
versión nueva sería ponerle un `purpose_id` a una posición, y es más tentadora porque una posición
*parece* individualizable.

Se rompe con un caso común: un fondo de $500.000 del que $300.000 son para Japón y $200.000 el fondo
de emergencia. Con `purpose_id` en la posición eso no se puede decir, y la única salida sería **tener
dos fondos** — la app dictándole al usuario cómo contratar en el banco.

### 4.2 Lo que el modelo ya dejó preparado

El modelo dice que *destinar sin guardar* todavía no existe y que **va a ser válido** cuando la plata
pueda estar fuera del disponible sin haber sido guardada. La puerta está abierta y el reparto por
monto es la forma correcta. Lo que cambia no es la mecánica: es **el techo**.

### 4.3 La consecuencia, que no se decide ahora

Hoy el techo del reparto es *lo guardado* en esa moneda. Con posiciones, el techo natural pasa a ser
*lo guardado + lo colocado*, y ahí aparece una pregunta que necesita pantalla:

> ¿«Japón: $300.000» es un número contra un pozo único, o son dos —«$100.000 guardado + $200.000 en el
> fondo»— que el usuario puede distinguir?

- **Pozo único**: más simple, un invariante. Pierde la respuesta a *«¿cuánto de lo de Japón puedo tocar
  hoy?»*, que en Argentina es la pregunta útil.
- **Distinguible**: contesta eso, y a cambio el reparto necesita saber contra qué se reparte — el borde
  por donde se cuela el `purpose_id` en la posición.

**Fuera del recorte de 3A** (§7). Lo único que hay que cuidar hasta entonces es no cerrarla sin
querer.

### 4.4 Qué se puede hacer hoy sin comprometer nada

Casi nada, y es buena noticia:

- **No agregar `position_id` a la tabla de repartos.** No existe y no debe existir.
- **No agregar `purpose_id` a nada nuevo.**
- Mantener el invariante donde está —en la base, disparando desde las dos tablas— porque el día que el
  techo cambie, **cambia en un solo lugar**.
- **Esta capa no toca la fase 2.** Si un diseño de instrumentos obliga a modificar el reparto, el mal
  planteado es el diseño.

---

## 5. UX y navegación

### 5.1 Dónde vive

Dentro de **«Ahorro e inversión»**, como un tercer bloque de la misma pantalla, después del total y
del desglose por propósito. No como pestaña, no como ruta propia, y **no colgando del detalle de una
cuenta**: una lista de productos financieros por cuenta es un home banking, que es exactamente lo que
Grana no es. La cuenta podrá tener un **atajo contextual**; no es su casa.

### 5.2 El nombre de la sección

> **Superado por §5.2c.** La recomendación de esta sección —«Puesto a trabajar»— **no es la decisión
> vigente**. Se conserva porque es el razonamiento que llevó a poner el naming en pantalla, que es lo
> que después destapó una cuarta opción que ninguna tabla iba a encontrar.

El nombre tiene que servir para **las tres fases**, no solo para la primera: lo que se elija con un
fondo adentro va a tener que aguantar un plazo fijo y, después, un CEDEAR. Renombrar una sección
cuesta más que nombrarla bien — es la lección que ya dejó «Ahorro e inversión».

| Candidato | Entiende un argentino común | Sirve FCI | Sirve PF | Sirve broker | ¿Se confunde con Guardado? | ¿Suena a banco/broker? | Voz de Grana |
|---|:--:|:--:|:--:|:--:|---|---|---|
| **En rendimiento** *(elegido)* | 🟢 alto | 🟢 | 🟢 | 🟡 un CEDEAR en baja no está «rindiendo» | 🟢 **No**: «guardado» es un acto tuyo, «en rendimiento» es un estado de la plata | 🟢 No | 🟢 Palabra corriente, no de folleto |
| **Puesto a trabajar** | 🟢 alto | 🟢 | 🟢 | 🟢 | 🟢 **No**: «guardado» es quieto, «trabajando» hace algo | 🟢 No | 🟢 Verbo del usuario |
| **Plata colocada** | 🟡 medio-alto | 🟢 | 🟢 | 🟡 se estira | 🟡 **Riesgo**: los dos son participios de «dejé la plata en algún lado» | 🟡 «Colocación» es palabra del que vende | 🟡 Correcta pero neutra |
| Inversiones | 🟢 alto | 🟢 | 🔴 no se siente inversión | 🟢 | 🟢 No | 🟡 | 🔴 Deja afuera protegerse, que es el acto argentino |
| A resguardo | 🟡 | 🔴 **falso**: se rescata en el día | 🟢 | 🔴 | 🟡 | 🟢 No | 🟡 |
| Instrumentos | 🔴 jerga | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 | 🔴 Nadie dice «mis instrumentos» |
| Fondos e inversiones | 🟢 | 🟢 | 🟡 un PF no es fondo | 🟡 | 🟢 | 🟡 | 🔴 Nombra la sección por el instrumento que entró primero |

**Recomendación: «Puesto a trabajar», con «Plata colocada» como segunda muy cerca.**

Y el desempate no es el gusto, es **la adyacencia**: en la misma pantalla, arriba, va a decir
**«Guardado»**. Un usuario que barre la pantalla lee dos bloques seguidos.

```
   Guardado          $ 200.000     ← quieto, en tus cuentas, decisión tuya
   Plata colocada    $ 500.000     ← ¿en qué se diferencia? los dos "dejé la plata ahí"
```
```
   Guardado          $ 200.000     ← quieto
   Puesto a trabajar $ 500.000     ← hace algo, y salió de la cuenta
```

El segundo par se explica solo; el primero necesita que alguien lo explique. Y el riesgo conocido de
«Puesto a trabajar» —que suene a promesa de rendimiento— se controla en la fila, que no muestra ningún
rendimiento (§5.5).

**Qué me haría cambiar de opinión:** que en el mock «Puesto a trabajar» se lea como que Grana promete
que la plata rinde. Es lo único que lo tumba, y se ve en pantalla, no en una tabla.

### 5.2b El nombre no se cierra acá: se cierra en el mock

Producto levantó **dos alertas** sobre «Puesto a trabajar» que esta tabla no puede resolver, porque
las dos son sobre cómo se lee y no sobre qué significa:

1. **Puede sonar a promesa de rendimiento o a lenguaje de fintech.**
2. **Puede confundirse con «plata trabajando para un propósito»** — que está justo arriba en la misma
   pantalla, con «Emergencia» y «Viaje».

Por eso el naming pasó a pantalla: **`docs/design/modelo-de-dinero/fase-3a-fci-naming.html`**, con las
tres versiones —A «Puesto a trabajar», B «Plata colocada», C «Inversiones» como control— con los
**mismos datos y la misma estructura**, y cada una debajo de «Guardado», que es donde va a estar
siempre.

**Y la recomendación de este documento no gobierna esa decisión.** Si en el mock A dispara cualquiera
de las dos alertas, gana B. Si C —el control— se entiende mucho mejor que las dos, la conclusión no es
usar C: es que ni A ni B se entienden y hay que buscar una cuarta.

### 5.2c Cerrado, y con una cuarta que esta tabla no tenía

**Ganó «En rendimiento»**, que no era ninguno de los tres del mock. Salió de contrastar el mock con
feedback externo, que es exactamente el desenlace que §5.2b había dejado previsto —«hay que buscar una
cuarta»— y la única razón por la que estaba previsto es que la comparación se hizo **en pantalla y con
los mismos datos**. En la tabla de arriba, «Puesto a trabajar» ganaba.

Por qué aguanta la adyacencia mejor que las dos anteriores: **«Guardado» y «Plata colocada» son los dos
participios de «dejé la plata en algún lado»**, y esa era la alerta conocida de B. «En rendimiento» no
compite en el mismo plano — **«Guardado» nombra un acto del usuario y «En rendimiento» nombra un estado
de la plata**. Son dos preguntas distintas y por eso no se pisan.

```
   Guardado          $ 200.000     ← lo apartaste vos; sigue en tus cuentas
   En rendimiento    $ 550.000     ← está haciendo algo, y no la podés gastar hoy
```

**Lo que el nombre cuesta, y está dibujado, no supuesto:**

| Costo | Dónde se ve | Cómo lo resuelve el mock v1 |
|---|---|---|
| **No regala el verbo.** «Plata colocada» daba «Colocaste» gratis; un estado no se conjuga | Card del mes, fila de Movimientos | Propone **«Pusiste a rendir»** —el rótulo más largo de la card, y entra—. Alternativas dibujadas: «A rendimiento» (corto, pero no es un acto) y «Colocaste» (suelto del nombre) |
| **Ocupa la palabra «rendimiento».** No puede nombrar además a un desenlace de lo que contiene | Rescate total, positivo | Cae «Rendimiento cobrado». Queda **«Resultado»** para los dos signos |
| **Un desenlace negativo lo contradice de frente** | Rescate total, negativo (pantalla 12) | No lo esconde: el nombre describe qué hace la plata, no promete cuánto. Es la pantalla donde hay que mirar si igual se lee como promesa incumplida |

El tercero es el único que puede tumbarlo, y **no se contesta leyendo**: se contesta mirando a alguien
rescatar en rojo. Si se cae, «Plata colocada» está a un rename de distancia y sin costo de modelo — el
nombre de la sección nunca fue un tipo interno (§5.3).

### 5.3 Nombre de sección ≠ tipos internos

Distinción que conviene fijar ahora porque evita discusiones futuras: **la sección tiene un nombre; las
filas tienen un estado.**

```
   PUESTO A TRABAJAR                                      ← nombre de la sección
   ├── FCI Mercado Pago        $ 800.000   con rescate    ← estado de la fila
   ├── Plazo fijo Comafi       $ 700.000   vence el 24/9  ← estado de la fila
   └── CEDEARs IOL             $ 300.000   valuación variable
```

Los tres estados —**con rescate**, **bloqueado a fecha**, **valuación variable**— son el atributo de
liquidez de §1.3, y en la fila dicen exactamente lo que el usuario necesita: **cuándo puedo tener esta
plata**.

Esto además resuelve el candidato «Con rescate»: **no es un nombre de sección** —se rompería en 3B,
porque un plazo fijo no se rescata, vence— **pero es un buen nombre de estado**. Nombrar la sección por
la propiedad del primer instrumento es el error que este orden de fases justamente busca evitar.

### 5.4 Sin nada, no hay bloque

Con cero posiciones la sección **no existe**. Ni card vacía, ni CTA gris, ni «todavía no invertiste».

Es la regla E8 del módulo, ya aplicada y QA-eada: *un módulo no se estrena mostrando lo que no hace*.
Un usuario que ve un bloque apagado esperando que él haga algo **aprende a ignorar la pantalla**, y esa
lección no se revierte cuando la funcionalidad llega.

La puerta de entrada no es un estado vacío: es **el acto** (§6).

### 5.5 Cómo mostrar un fondo sin convertir Grana en una app de trading

```
  🟢  FCI Mercado Pago                          $ 800.000
      Pusiste $800.000 · con rescate
```

**Dos números y ninguno más**: cuánto pusiste y cuándo lo podés tener. **No** el valor de la cuota
parte, **no** el rendimiento del día, **no** una flecha verde o roja, **no** un porcentaje, **no** un
gráfico.

> Una app de trading se reconoce porque **el número cambia solo mientras la mirás**. Acá el número
> cambia cuando el usuario hace algo.

Es la misma disciplina que ya aplica el resto de Grana: la card del dashboard tampoco muestra el saldo
minuto a minuto — muestra lo que pasó.

Y cuatro reglas más, cada una contra un fracaso concreto:

1. **Grana no ofrece productos.** No hay lista de fondos disponibles, ni tasas comparadas, ni
   «invertí acá». *Describe hechos sobre la plata del usuario; no recomienda instrumentos.*
2. **No hay benchmark contra inflación ni contra el dólar.** Eso es la fase 5 y es otra vara.
3. **No hay performance, TIR ni comparativas.** Eso es asesorar.
4. **El alta la abre el movimiento, no un catálogo.**

### 5.6 El usuario que solo quiere controlar gastos

Es la mayoría, y es a quien esta capa puede arruinarle la app. Tres defensas:

- **El bloque no existe hasta que hay algo adentro** (§5.4).
- **El dashboard no cambia.** La card del mes gana una línea **solo en los meses en que pasó algo** —
  por ser flujo, no stock. Quien nunca puso plata a trabajar no la ve nunca.
- **El módulo se puede apagar entero**, y esa decisión ya está normada. Esta capa hereda ese borde en
  vez de crear uno nuevo.

---

## 6. Las operaciones de FCI v1

Es el corazón de esta revisión. Cinco operaciones, y **dos caminos de alta que no son el mismo**.

### 6.1 Camino A — Cargar una posición que ya existía

> *«Ya tenía $250.000 en un FCI antes de registrarlo en Grana.»*

Es el caso del usuario que llega a Grana con la vida financiera ya armada, y **si no está, la app le
pide que mienta**: la única forma de registrar ese fondo sería fingir que lo suscribió hoy.

**Reglas:**

- Es **carga de stock preexistente**, no una operación.
- **No crea salida del mes actual** ni ninguna línea en la card.
- **No inventa que hoy salió plata de una cuenta.**
- **No baja «Para gastar»** — y este punto merece la explicación de abajo.

**¿Ese stock afecta «Para gastar» desde la carga?**

**No, y por construcción.** «Para gastar» sale de los **saldos de las cuentas**, y una posición no es
una cuenta: cargarla no resta nada porque no hay nada que restar. Si el fondo ya estaba afuera de las
cuentas del usuario, el disponible **ya era correcto antes** de cargar la posición. La carga solo hace
visible algo que Grana no sabía; no cambia ningún número que ya estaba bien.

**El problema real: la duplicación.**

El riesgo no es el disponible, es el **patrimonio**. Si el usuario, al crear su cuenta en Grana, cargó
como saldo inicial el total que le mostraba el banco —y ese total incluía el fondo— entonces cargar la
posición cuenta esa plata **dos veces**: una adentro del saldo de la cuenta y otra como posición.

Grana no puede saber cuál de los dos casos es. Tres salidas:

| Salida | Qué implica | |
|---|---|---|
| **Preguntar en el alta** | *«¿esta plata está incluida en el saldo de alguna cuenta tuya en Grana?»* Si dice que sí, hay que corregir esa cuenta | **Propuesto** |
| No preguntar y avisar | Un texto de advertencia que la mitad no lee. El total queda inflado y sin explicación | Descartado |
| Forzar el camino B | Inventa un movimiento de hoy que no existió, y rompe la card del mes | Descartado |

**Y si el usuario dice que sí está incluida, ¿qué se hace?** La corrección **no puede ser una
suscripción** —no pasó hoy— así que la candidata natural es un **ajuste de saldo de esa cuenta**, que
es un tipo que Grana ya tiene y que ya significa *«plata que se movió sin registrar»*. Es honesto: la
plata efectivamente salió de esa cuenta en algún momento que Grana no vio.

Queda como pregunta abierta si ese ajuste lo hace la app o se le pide al usuario que corrija la cuenta
— la primera es mejor UX y la segunda no inventa nada. Se decide con la pantalla (§10).

**Qué pide el alta A:** entidad o nombre del fondo · monto · moneda · fecha desde la que lo tenés
(opcional, informativa) · si está incluido en el saldo de una cuenta.

**¿Pide cuenta/custodio asociado?** *Propuesto: opcional.* Sirve para el corte por ubicación y para el
atajo desde la cuenta, pero exigirlo en el alta le pide al usuario un dato que quizás no tenga claro
—«¿el fondo de la billetera es de Mercado Pago o del banco?»— para una carga que solo quiere reflejar
lo que ya tiene.

### 6.2 Camino B — Suscribir: poner plata hoy

> *«Hoy puse $100.000 en un FCI.»*

**Reglas:**

- Sale de una cuenta `cash` o `bank`.
- **Baja «Para gastar»**, porque el saldo de la cuenta baja de verdad.
- **No es gasto de consumo.**
- Es un **movimiento financiero**: un cambio de estado de liquidez.
- **Crea o aumenta** una posición.

**¿Cómo se ve en el mes?** Con **una línea nueva, de flujo**:

```
   Resumen del mes · agosto
   Tenías              −$ 2.729.825,17
   Entró               +$ 8.021.007,00
   Se fué              −$   205.433,66     ← el gasto real, intacto
   Guardado            −$   180.000,00     ← stock, como siempre
   Puse a trabajar     −$   100.000,00     ← NUEVA, y solo si pasó este mes
   Para gastar          $ 4.805.748,17
```

La línea **explica la baja de liquidez sin meterla en «Se fué»**, que es exactamente el requisito. Y
al ser flujo, en un mes cerrado **se queda** — a diferencia de «Guardado», que desaparece.

**¿Vive en Movimientos, en el resumen del mes, o en ambos?**

**En los dos, con tratamiento propio** — y no es una excepción nueva: es lo que Grana ya hace con
`transfer` y con `exchange`. Los dos son movimientos reales que aparecen en la lista y que **están
fuera de la analítica de gastos**. La suscripción se comporta igual:

| Superficie | Aparece | Cómo |
|---|---|---|
| **Movimientos** | Sí | Como fila propia, con su ícono. No es gasto ni ingreso |
| **Resumen del mes** | Sí | Como la línea nueva de flujo |
| **En qué se fue** (analítica) | **No** | No es consumo. Ensuciaría todas las categorías |
| **Tira de ritmo** | **No** | No es gasto |

**Qué pide el alta B:** monto · cuenta de origen · fecha · fondo (existente o nuevo).

### 6.3 Sumar capital

> *«Puse $100.000 más en el mismo FCI.»*

Es el camino B apuntando a una posición que ya existe. **Pide lo mínimo: monto, cuenta de origen,
fecha.**

**No pide** VCP, cuotapartes, tasa ni rendimiento estimado. Ninguno de esos datos hace falta para el
circuito, y pedirlos convierte una operación de tres campos en un formulario de banco.

### 6.4 Rescate total

> *«Rescaté todo y volvieron $380.000 a mi cuenta.»*

**Pide: monto que volvió · cuenta destino · fecha.** Tres campos, y el usuario los tiene todos delante
—se los acaba de decir el banco—.

**Grana calcula:**

```
   $ 380.000  volvieron
   $ 350.000  capital registrado
   ─────────────────────────
   +$ 30.000  resultado realizado
```

Y lo trata según §3.5: positivo es rendimiento, negativo es pérdida, ninguno de los dos es sueldo ni
gasto de consumo, y los dos explican la variación de liquidez.

La posición se cierra. **Es el momento en que la verdad llega**, sin haber estimado nada en el camino.

### 6.5 Rescate parcial — el caso difícil

> *«Rescaté $200.000 y dejé el resto.»*

Es lo único del recorte sin respuesta obvia, y la restricción es clara: **no resolverlo con precisión
técnica si eso obliga al usuario a cargar VCP o cuotapartes.**

Cuatro caminos:

| | Cómo funciona | A favor | En contra |
|---|---|---|---|
| **1 · Reducir capital primero** | El rescate baja el capital registrado. No hay resultado hasta que lo rescatado acumulado **supere** el capital. El resto se reconoce al cerrar | **Cero campos nuevos.** Exacto en el total. Evita el prorrateo, que el modelo tiene como pregunta abierta | Difiere el resultado. La fila muestra capital pendiente, no lo que vale |
| **2 · Preguntar «¿cuánto quedó en el fondo?»** | Con eso se deduce el valor total y se prorratea la ganancia | **Un solo campo**, y el usuario lo lee de la pantalla del banco. Exacto en el momento | Le pide un dato justo cuando está sacando plata. Mete prorrateo en la v1. Decimales que no puede verificar |
| **3 · Pedir capital vs. ganancia** | El usuario declara cuánto de lo que volvió es ganancia | Simple de implementar | **Le pide una cuenta que él no tiene hecha.** La mayoría no sabe, y va a poner cualquier cosa |
| **4 · Cuotapartes / VCP** | El modelo financiero real | Correcto | **Vetado por el recorte.** Es pedirle al usuario que sea un back office |

**Recomendación: 1**, con la limitación **dicha en pantalla y no escondida**.

Cómo se comporta, con números:

```
   Pusiste           $ 350.000     capital registrado
   Rescatás          $ 200.000  →  capital pendiente: $ 150.000 · sin resultado todavía
   Rescatás          $ 200.000  →  capital pendiente: $       0 · resultado: +$ 50.000
```

Es una **aproximación honesta**: no pierde plata, difiere el momento. Y tiene dos consecuencias que
hay que asumir en vez de disimular:

- **La fila no dice «tenés $150.000», dice «pusiste $150.000».** Es copy, y es lo que la hace no
  mentir.
- **Una posición rescatada a medias y nunca cerrada deja el resultado sin reconocer para siempre.** Se
  mitiga con la acción de cerrar/actualizar la posición, que existe en el recorte.

**Y no cierra la puerta:** el camino 2 es la evolución natural el día que la valuación exista, y no
requiere haber guardado cuotapartes. Elegir 1 hoy no obliga a rehacer nada mañana.

> **Esto es una simplificación manual elegida, no una verdad financiera.** Queda escrito acá y tiene
> que quedar escrito en la pantalla: el usuario tiene derecho a saber que Grana está redondeando el
> *cuándo*, no el *cuánto*.

---

## 7. Recorte propuesto de la fase 3A

### 7.1 El orden de las fases

| Fase | Qué entra | Estado interno de las filas |
|---|---|---|
| **3A** | **FCI / fondos con rescate** | «con rescate» |
| **3B** | Plazo fijo / bloqueado a fecha | «bloqueado a fecha» |
| **3C** | Brokers, CEDEARs, acciones | «valuación variable» |
| **—** | **USD** | **No es una fase.** Es moneda y cambio, y ya existe (§2.4) |

### 7.2 Entra en 3A

- **Camino A**: cargar una posición existente, con la pregunta de duplicación (§6.1).
- **Camino B**: suscribir hoy desde una cuenta `cash` o `bank` (§6.2).
- **Sumar capital** a una posición existente (§6.3).
- **Rescate total** con resultado calculado (§6.4).
- **Rescate parcial** con la simplificación del camino 1 (§6.5).
- **Actualización manual del valor**, opcional y puntual.
- **Cerrar una posición** sin movimiento, para el que dejó de tenerla.
- **La línea nueva de flujo** en la card del mes.
- **El bloque en `/savings`**, con filas de dos números y estado.

### 7.3 No entra en 3A

| Fuera | Por qué |
|---|---|
| **Cuotapartes y VCP** | Convierte al usuario en back office. Y no hace falta: la verdad llega con el rescate |
| **Cotización automática** | Integración y dependencia externa |
| **Rendimiento diario** | Requiere valuación continua, e invita a mirar la app como un tablero |
| **Gráficos y evolución** | Es la fase 5. Un gráfico acá convierte la pantalla en un broker |
| **Benchmark contra inflación o dólar** | Otra vara, otra fase |
| **Integración bancaria o de broker** | 3C como mínimo |
| **Promesas de performance, TIR, comparativas** | Eso es asesorar |
| **Plazo fijo y vencimientos** | 3B |
| **Renovación y capitalización** | 3B |
| **CEDEARs y acciones** | 3C |
| **Asignar posiciones a propósitos** | §4.3 |

### 7.4 T+0 / T+1 / T+2

Existe, el usuario lo conoce, y en la primera versión **no gobierna nada**: nada se calcula distinto
según eso. Si entra, entra como **rótulo del fondo** —un dato que se muestra— y no como regla del
modelo.

Convertirlo en regla obligaría a definir qué pasa un viernes a las 18, y esa pregunta no la abre esta
fase.

---

## 8. Riesgos de empezar por FCI

Ordenados por lo que costaría arreglarlos tarde.

| # | Riesgo | Mitigación propuesta |
|---|---|---|
| 1 | **Se pierde la ventaja del contrato**: nadie le dice a Grana cuánto vale el fondo hoy | La verdad llega con el rescate (§3.4). Valuación manual y opcional |
| 2 | **Se empieza por el borde del criterio de admisión** | El criterio pasa a ser de comportamiento y lo declara el usuario (§2.1, §2.2) |
| 3 | **El rescate parcial obliga a una simplificación** que no es financieramente exacta | Elegida a conciencia, dicha en pantalla, y con camino de evolución que no requiere rehacer (§6.5) |
| 4 | **Diseñar la lista alrededor del «con rescate»** y que el plazo fijo no entre sin rehacer | Dibujar el mock con **las tres filas de estado desde el primer día**, aunque solo se implemente una (§5.3) |
| 5 | **Que el usuario crea que Grana le está diciendo cuánto rinde** | La fila muestra cuánto pusiste, nunca un rendimiento (§5.5) |
| 6 | **Duplicar patrimonio** con el camino A | La pregunta de duplicación en el alta (§6.1) |
| 7 | **Que el bloque le aparezca al que solo controla gastos** | Sin nada, no hay bloque (§5.4) |

El riesgo 4 es el que este orden de fases hereda de la versión anterior con el signo cambiado: antes
era «que todo asuma vencimiento», ahora es «que todo asuma rescate». **La mitigación es la misma:
dibujar los tres estados aunque se implemente uno.**

---

## 9. Decisiones

### 9.1 Se pueden tomar ahora

| # | Decisión |
|---|---|
| 1 | **El orden es 3A fondos con rescate · 3B plazo fijo · 3C variables.** USD no es fase |
| 2 | **El criterio de admisión es de comportamiento, no de producto**: *¿puedo pagar sin hacer nada antes?* |
| 3 | **Lo clasifica el usuario**, no la app por el nombre del producto |
| 4 | **Una cuenta usable para pagar sigue siendo cuenta**, aunque rinda |
| 5 | **Un fondo que exige rescate es posición**, aunque sea T+0 |
| 6 | **USD es moneda, no instrumento**. Comprarlo es cambio de moneda |
| 7 | **Hay dos caminos de alta distintos** (cargar existente / suscribir hoy), y no se pueden colapsar |
| 8 | **Cargar una posición existente no toca el ledger ni la card del mes** |
| 9 | **Cargar una posición existente no baja «Para gastar»**: el disponible ya era correcto |
| 10 | **Suscribir sí baja «Para gastar»**, con una línea de **flujo** en la card |
| 11 | **Ni gasto ni ingreso**, ni la salida, ni la vuelta, ni el resultado |
| 12 | **Vive en Movimientos y en el resumen, fuera de la analítica de gastos** — como `transfer` |
| 13 | **La primera versión no construye valuación**: vale lo que pusiste; la verdad llega con el rescate |
| 14 | **Sin cuotapartes, sin VCP, sin cotización, sin rendimiento diario, sin gráficos, sin benchmark, sin integración, sin promesas** |
| 15 | **El rescate parcial reduce capital primero**, y el resultado se reconoce al superarlo o al cerrar |
| 16 | **La simplificación se dice en pantalla**, no se esconde |
| 17 | **Ninguna posición lleva `purpose_id`** |
| 18 | **Nombre de sección ≠ estado de fila.** La sección se llama una cosa; las filas dicen «con rescate», «bloqueado a fecha», «valuación variable» |
| 19 | **Sin nada, no hay bloque** |
| 20 | **T+0/T+1/T+2 es rótulo, no regla**, en la v1 |
| 21 | **Cripto queda fuera** |

### 9.2 No se deben tomar todavía

| # | Pregunta | Por qué esperar |
|---|---|---|
| A | **¿El techo del reparto pasa a «guardado + colocado», y el propósito distingue las dos partes?** | Es la pregunta central de la fase 4. Necesita pantalla |
| B | **El nombre definitivo de la sección** | Provisoriamente **«En rendimiento»** (§5.2c). Lo único que puede tumbarlo es que un rescate en rojo lo haga leer como promesa incumplida, y eso se mira, no se argumenta |
| C | **El verbo del mes** | El nombre elegido es un estado y no regala uno. **«Pusiste a rendir»** es la propuesta; «A rendimiento» y «Colocaste» están dibujadas al lado (pantalla 15). El *resultado* ya no es parte de esta pregunta: no lleva línea propia en la card |
| D | **Si la corrección por duplicación la hace la app** (ajuste automático) **o se le pide al usuario** | UX vs. no inventar. Se ve en la pantalla del alta A |
| E | **Si el custodio es obligatorio u opcional** en el alta | Depende de si el corte por ubicación entra en 3A |
| F | **Qué hace Grana con el drift** de las cuentas que rinden solas | Ya abierto en el modelo; esta capa lo agrava |
| G | **Prorrateo entre repartos** cuando una posición compartida cambia de valor | Depende de A |
| H | **¿La posición tiene cuenta padre?** (el problema del comitente) | Aparece con brokers, en 3C |

---

## 10. Preguntas abiertas para las pantallas

Las que solo se contestan dibujando, agrupadas por pantalla.

**Alta A — cargar lo que ya tengo**

- ¿Cómo se pregunta la duplicación **sin asustar**? *«¿Esta plata ya está contada en el saldo de alguna
  de tus cuentas?»* es entendible, pero le pide al usuario que entienda cómo Grana calcula.
- ¿Qué pasa si contesta mal? ¿Se puede corregir después sin rehacer la posición?
- ¿Pide fecha «desde cuándo lo tenés»? Es informativa; ¿aporta o es un campo de más?

**Alta B — suscribir**

- ¿Se entra desde el módulo, desde la cuenta, o desde el alta de movimiento? Las tres son defendibles.
- ¿Cómo se elige entre «fondo que ya tengo» y «fondo nuevo» sin que parezca un selector de productos?

**La fila**

- ¿«Pusiste $800.000» se entiende, o el usuario espera ver **cuánto tiene**?
- ¿El estado —«con rescate»— se lee como información o como jerga?
- ¿Con cuántas posiciones deja de servir la lista plana?

**Rescate parcial**

- ¿La simplificación se entiende, o el usuario espera ver la ganancia **en el momento**?
- ¿Dónde se dice, sin que sea un disclaimer que nadie lee?

**La card del mes**

- ¿**«Pusiste a rendir»** funciona como rótulo de línea? Es el más largo de la card y el nombre de la
  sección no lo regala: hay que elegirlo, no derivarlo.
- ¿Qué pasa en un mes con suscripción **y** rescate? ¿Dos líneas, o una neta? *(Una neta escondería
  que hubo dos actos; dos líneas alargan la card.)* El mock v1 propone **dos**.

**El nombre**

- ¿**«En rendimiento»** aguanta una posición que dio negativo? Es lo único que lo tumba, y se ve en la
  pantalla 12 del mock v1, no en una tabla.
- ¿Se distingue de «Guardado» leyéndolos seguidos? La apuesta es que sí porque no compiten en el mismo
  plano —uno nombra un acto tuyo, el otro un estado de la plata—, pero es una apuesta.

---

## 11. Qué tiene que validar un mock antes de pasar a schema

**Ningún dato, ninguna tabla y ningún SQL hasta que un mock conteste esto.** El orden importa: es el
mismo que evitó que el propósito naciera colgado de una fila.

| # | Lo que el mock tiene que probar | Si falla |
|---|---|---|
| 1 | **Que un usuario entienda por qué esa plata no está en «Para gastar»** | Falla la premisa entera de la capa |
| 2 | **Que los dos caminos de alta se distingan sin explicación** | Van a cargar mal el stock preexistente y el patrimonio queda inflado |
| 3 | **Que la pregunta de duplicación se pueda contestar** por alguien que no sabe cómo Grana calcula | Hay que buscar otra forma, o resignar el camino A |
| 4 | **Que la línea nueva del mes no se lea como gasto** | Vuelve el problema que este documento existe para evitar |
| 5 | **Que la fila no parezca un broker** | El bloque cambia de tono y arrastra al módulo entero |
| 6 | **Que la simplificación del rescate parcial se acepte** | Hay que ir al camino 2 y meter un campo más en la v1 |
| 7 | **Que el nombre de la sección no se confunda con «Guardado»**, estando uno arriba del otro | Se cambia el nombre, que es barato ahora y caro después |
| 8 | **Que la lista aguante tres estados distintos** aunque solo uno esté implementado | 3B y 3C obligan a rehacer la lista |

**Recién con esas ocho contestadas** tiene sentido preguntarse qué datos hacen falta — y ahí, seguro,
la respuesta va a ser más chica de lo que parecía antes de dibujar.

**Las ocho ya tienen pantalla** (`fase-3a-fci-v1.html`, sección E), lo que no es lo mismo que tenerlas
contestadas: ninguna se contesta leyendo el mock. Se contestan mirando a alguien usarlo.

---

## 12. Cómo sigue

1. **Nada de esto se implementa antes del QA visual nativo de `extract-savings-module`.** Es la
   compuerta vigente, y el change está congelado.
2. ✅ **Los dos mocks existen.** `fase-3a-fci-naming.html` sacó el naming de la prosa y comparó tres
   nombres con los mismos datos; su desenlace fue el que él mismo había previsto —ninguno de los tres,
   una cuarta (§5.2c)—. **`fase-3a-fci-v1.html` es ahora la referencia de la fase**: diecisiete
   pantallas con la dirección cerrada, los dos estados sin nada, las dos altas con la pregunta de
   duplicación y sus dos ramas, el rescate total **en los dos signos**, el parcial y la fila que queda
   después, y las líneas del mes. **Ninguna tabla, ningún schema, ninguna migración.**
3. `docs/design/modelo-de-dinero/fase-3a-plazo-fijo.html` **cambia de número**: pasa a ser referencia
   de la **3B**. Su razonamiento contable —stock vs. flujo, el interés que no es ingreso— sigue vigente
   y es de donde sale medio este documento; lo que cambia es cuándo se construye.
4. Con el mock delante, contestar las ocho de §11 y las de §10. Recién después, un change.
