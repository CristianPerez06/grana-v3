## MODIFIED Requirements

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) como una **vista compacta agrupada por banco** (NO como wallet de cards grandes), conservando el hero unificado, con esta estructura de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resumen de <mes>"). Acción primaria "Agregar tarjeta" (primitivo `Button`). En ambas plataformas el CTA SHALL abrir el flujo de alta de tarjeta: en web navega a `/cards/new` (o abre el drawer de alta); en mobile navega a la ruta `/cards/new` nativa. El CTA NO SHALL renderizarse como placeholder permanentemente disabled. La carga de catálogos (instituciones / redes) puede gatear el submit/CTA mientras resuelve (web deshabilita el CTA; mobile defiere la carga a la ruta `/cards/new`, que muestra un loading state propio).
2. **Hero del mes (card navy, dos columnas)**: el hero SHALL renderizarse como una card oscura navy (mismo patrón de superficie que el hero del dashboard). A la **izquierda**, **dos cifras** mostradas juntas, cada una en **Bimoneda** (ARS primario y USD subordinado, **NUNCA sumados ni convertidos**):
   - **A pagar (ahora)** (`summary.toPayARS` / `toPayUSD`): la suma del total a pagar de **todas** las tarjetas activas que ya tienen un resumen **cerrado e impago** (deuda firme, vence ~este mes). Cuando la cifra es cero, el hero SHALL mostrar **`$ 0`** — NO un texto de empty-state.
   - **En curso** (`summary.inProgressARS` / `inProgressUSD`): la suma de los resúmenes **abiertos (aún no cerraron) con saldo > 0** de **todas** las tarjetas activas. Es el **acumulado real** de los consumos del ciclo abierto (no una proyección): un piso que sigue creciendo hasta el cierre. SHALL llevar el caption **"se sigue sumando hasta el cierre"**. Cuando es cero, SHALL mostrar `$ 0`.
   A la **derecha**, **"Próximos cierres"**: una lista de **una tarjeta por fila** (`fecha de cierre · nombre`, **sin monto** — el monto por tarjeta vive en el detalle de cada tarjeta del listado), ordenada por **fecha de cierre** (NO de vencimiento) ascendente y **capada en `NEXT_CLOSES_CAP` (6)** (`summary.nextCloses`). En viewports angostos las dos zonas se apilan.
3. **Controles de vista**: una fila de filtros/orden con `Por banco` (default) y `Todas` (plano), más filtros opcionales `En uso`, `Vencen pronto`, `Con saldo`. Los controles NO SHALL alterar la semántica contable, solo el agrupado, el orden y el subconjunto visible.
4. **Vista compacta de tarjetas activas**. El componente público SHALL llamarse `Wallet` en ambas plataformas (mismo nombre que el actual), con presentación compacta agrupada por banco:
   - **Grupos por banco desplegables (collapsible).** Cada grupo tiene un encabezado con: chevron de colapso, dot del color del banco, nombre del banco, "N tarjetas · M en uso", total a pagar del banco (si > 0) y un **badge de urgencia** con el próximo vencimiento del grupo (color heredado del peor estado del grupo: rojo > ámbar > neutro). Tap/click en el encabezado expande/colapsa el cuerpo.
   - **Auto-colapso inicial.** Un grupo SHALL arrancar **colapsado solo si todas sus tarjetas están al día y en $0** (sin deuda, sin saldo en ninguna moneda, sin alert de vencimiento). Cualquier grupo con al menos una tarjeta vencida, por vencer, o con saldo > 0 SHALL arrancar **expandido**.
   - **2 filas por tarjeta.** Cada tarjeta se renderiza en dos filas: **fila 1** = monograma de red + nombre | monto del resumen vigente | indicador de estado; **fila 2** = tres etiquetas micro apiladas **Cierre**, **Vence** y **Uso** (label en mayúscula + valor debajo). El valor de Uso es el **porcentaje del resumen vigente** sobre el límite (o el texto **"Sin límite"** cuando no hay límite).
   - **Web**: filas dentro de los grupos desplegables (no una tabla rígida de una sola fila por tarjeta).
   - **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco, sin tabla horizontal.
5. **Sección "Archivadas"** colapsable debajo, cerrada por defecto, solo cuando existe ≥1 tarjeta archivada, con encabezado "Archivadas (N)" y enlace al detalle de cada una. Web usa `<details>` nativo; mobile usa `Pressable` + `useState`.

**Estado por fila (vinculante).** Cada fila SHALL exponer SIEMPRE un indicador de estado derivado de `pillTone(activePeriod.alert, activePeriod.variant)` (vencido / por vencer / al día). El indicador SHALL permanecer visible en cualquier orden o agrupado, de modo que una deuda no quede escondida; combinado con el badge de urgencia del encabezado y la regla de auto-colapso, un grupo con deuda nunca queda oculto sin señal.

**Bimoneda en el monto (vinculante).** La zona de monto del resumen SHALL respetar Bimoneda: si solo una moneda tiene saldo, ese monto; si ambas tienen saldo, ARS primario arriba y USD subordinado debajo, **nunca sumados ni convertidos**. Los montos de dinero usan los tonos editoriales (`text-income`/`text-expense`), no tokens crudos.

**"A pagar" vs "En curso" (vinculante).** Las dos cifras del hero son conceptos distintos y NO SHALL solaparse ni sumarse entre sí:
- **A pagar (ahora)** = resúmenes ya **cerrados e impagos** (`(end_date < hoy || due_date < hoy) && tx_count > 0 && !has_payment`). Es la deuda firme.
- **En curso** = el resumen **abierto** (no cerrado, sin pago) **con saldo > 0** de cada tarjeta activa. La cifra SHALL considerar el resumen abierto de **cada** tarjeta — incluidas las tarjetas que **además** tienen un resumen "a pagar", que tienen **dos resúmenes vivos** a la vez (el cerrado a pagar y el siguiente devengándose). Por lo tanto NO se deriva únicamente del `activePeriod` por tarjeta.

**Uso del resumen (vinculante).** El stat **Uso** de la fila 2 SHALL mostrar el porcentaje de uso del **resumen vigente**, calculado `min(100, round(pendingARS_del_resumen_vigente / credit_limit * 100))`, del resumen vigente, NO el cupo disponible. Cuando `credit_limit` es null, el stat Uso SHALL mostrar el texto **"Sin límite"**. Se renderiza como un stat apilado compacto junto a Cierre/Vence (no una barra ni pegado al monto de la derecha). Mismo tratamiento en web y mobile (paridad).

**Agrupación por banco (vinculante).** El agrupado usa el nombre de la institución (`institution.name`). Las tarjetas con `institution_id` null SHALL agruparse en un grupo fallback **"Sin banco"**, siempre último, nunca mezclado con otro banco.

**Conteo "en uso" (vinculante).** El contador "M en uso" del encabezado de grupo y el filtro `En uso` SHALL derivar del flag `inUse` por tarjeta (`activePeriod.tx_count > 0 || activeInstallmentsCount > 0`).

**Orden.** Los grupos se ordenan por su próximo vencimiento más urgente; dentro de cada grupo, las filas se ordenan por vencimiento ascendente. En modo "Todas" (plano), el orden SHALL ser por próximo vencimiento ascendente, con las tarjetas sin ciclo configurado al final.

La navegación de una fila (click web / tap mobile) SHALL ir a `/cards/[id]`. La vista incluye únicamente tarjetas activas (`is_active=true`).

#### Scenario: El hero muestra "A pagar ahora" y "En curso" en Bimoneda

- **WHEN** el usuario tiene una tarjeta con un resumen cerrado e impago de `$120.000` ARS, y dos tarjetas con resúmenes abiertos con saldo (`$80.000` ARS + `US$ 200` una, `$50.000` ARS la otra)
- **THEN** el hero, en una card navy, muestra **"A pagar"** = `$120.000` ARS
- **AND** muestra **"En curso"** = `$130.000` ARS primario y `US$ 200` USD subordinado, con el caption "se sigue sumando hasta el cierre"
- **AND** ninguna de las dos cifras suma ni convierte ARS y USD entre sí, ni suma "A pagar" con "En curso"

#### Scenario: Sin resúmenes cerrados, "A pagar" muestra $0 y "En curso" el acumulado del ciclo

- **WHEN** el usuario no tiene ningún resumen cerrado e impago, pero tiene resúmenes en curso con saldo por `$90.000` ARS
- **THEN** "A pagar" muestra **`$ 0`** (no un texto de empty-state)
- **AND** "En curso" muestra `$90.000` ARS

#### Scenario: "En curso" incluye el resumen abierto de una tarjeta que también tiene un "a pagar"

- **WHEN** una tarjeta tiene un resumen **cerrado e impago** de `$100.000` (cuenta en "A pagar") y, a la vez, su resumen **siguiente abierto** ya devengó `$30.000`
- **THEN** "A pagar" incluye los `$100.000` de esa tarjeta
- **AND** "En curso" incluye los `$30.000` del resumen abierto de esa misma tarjeta

#### Scenario: Próximos cierres lista una fila por tarjeta con período en curso, sin monto

- **WHEN** hay cuatro tarjetas con resúmenes en curso que cierran en distintas fechas
- **THEN** "Próximos cierres" muestra una fila por tarjeta (`fecha de cierre · nombre`, sin monto), ordenadas por fecha de cierre ascendente
- **AND** la lista incluye la tarjeta cuyo resumen "a pagar" está cerrado pero cuyo resumen siguiente sigue abierto (no se pierde su próximo cierre)
- **AND** la lista se capa en `NEXT_CLOSES_CAP` (6)

#### Scenario: El CTA "Agregar tarjeta" abre el flujo de alta nativo en mobile

- **WHEN** el usuario está en `/cards` mobile con las queries de catálogo ya cargadas y toca "Agregar tarjeta"
- **THEN** la app navega a la ruta de alta de tarjeta nativa (`/cards/new`)
- **AND** el CTA NO se renderiza como placeholder permanentemente disabled

### Requirement: El alta de tarjeta captura solo las fechas del resumen actual y crea el siguiente período estimado

El formulario de alta de tarjeta SHALL pedir únicamente el cierre y el vencimiento del resumen actual (`current_end_date`, `current_due_date`) — las dos fechas que el último extracto emitido anunció. El alta NO SHALL pedir fechas del próximo resumen.

El alta de tarjeta SHALL estar disponible en **web y mobile** (paridad). Ambas plataformas SHALL ejecutar la **misma** lógica de creación, expuesta como una única mutación compartida `createCreditCard` en `@grana/cards` que recibe `{ supabase, userId, input, today }`, valida con `createCreditCardSchema` y devuelve un resultado neutral (`CardMutationResult`: `{ ok: true, id }` o `{ ok: false, fieldErrors? | messageKey? | errorCode? }`). El paquete NO SHALL traducir texto: cada consumer resuelve el mensaje con su helper de i18n (`next-intl` en web, `useT` en mobile). El server action de web y el wrapper `lib/cards/mutations.ts` de mobile SHALL ser shells finos sobre esa mutación, divergiendo solo en resolución de `userId`, mapeo de error e invalidación/revalidación de caché. La presentación del formulario SHALL ser idiomática por plataforma (drawer/página en web; ruta nativa en mobile) conservando los mismos nombres y props públicas del componente (`CreateCardForm`).

Al crear la tarjeta, el sistema SHALL insertar dos períodos:

- **P1 (real)**: `start_date = current_end_date − 30 días`, `end_date = current_end_date`, `due_date = current_due_date`, `is_estimated = false`.
- **P2 (estimado)**: `start_date = current_end_date + 1 día`, con `end_date` y `due_date` proyectados mediante el algoritmo de sugerencia sobre los períodos existentes, `is_estimated = true`.

#### Scenario: Alta con dos fechas crea P1 real y P2 estimado

- **WHEN** un usuario da de alta una tarjeta con `current_end_date='2026-06-16'` y `current_due_date='2026-06-22'`
- **THEN** se crea P1 con `start_date='2026-05-17'`, `end_date='2026-06-16'`, `due_date='2026-06-22'`, `is_estimated=false`
- **AND** se crea P2 con `start_date='2026-06-17'`, `is_estimated=true`, y `end_date`/`due_date` proyectados desde P1

#### Scenario: El formulario no ofrece campos del próximo resumen

- **WHEN** el usuario abre el drawer de alta de tarjeta
- **THEN** la sección de ciclo muestra solo cierre y vencimiento del resumen actual
- **AND** el submit se habilita sin ningún dato del próximo resumen

#### Scenario: Consumo posterior al cierre cae en el período estimado

- **WHEN** la tarjeta tiene P1 (`end_date='2026-06-16'`) y P2 estimado, y el usuario registra un consumo con `date='2026-06-18'`
- **THEN** la transacción se inserta con `card_period_id` apuntando a P2
- **AND** no se pide ninguna fecha al usuario

#### Scenario: El alta nativa en mobile crea la tarjeta con la misma lógica que web

- **WHEN** el usuario completa el `CreateCardForm` nativo (institución, red o nombre custom, monedas con ARS, cierre y vencimiento del resumen actual) y confirma
- **THEN** mobile invoca la mutación compartida `createCreditCard` de `@grana/cards` con el `userId` autenticado y `today`
- **AND** se crean el account `type=credit`, sus `account_currencies` y los dos `card_periods` (P1 real + P2 estimado) idénticos a los que crearía web con el mismo input
- **AND** ante éxito se invalidan las query keys de cards y la app vuelve a `/cards`; ante error se muestra el mensaje resuelto desde `messageKey`/`fieldErrors` con `useT`, sin texto pre-traducido por el paquete
