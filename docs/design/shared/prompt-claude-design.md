# Prompt de diseño — Rediseño del módulo Compartido

> Prompt entregado a Claude Design el 2026-06-22 para generar mockups exploratorios
> (modo abierto: 4+ variantes por pantalla del corazón). Ancla: el documento
> [decisiones-rediseno.md](./decisiones-rediseno.md). Los mockups que vuelvan se
> evalúan contra ese doc.

---

## Contexto
Grana es una app de finanzas personales (es-AR), bimoneda ARS/USD. El módulo
"Compartido" sirve a DOS personas (una pareja) que comparten gastos. Vas a proponer
mockups exploratorios de varias pantallas. Trabajá en español rioplatense.

Fuentes que DEBÉS leer antes de diseñar:
- docs/design/shared/decisiones-rediseno.md  ← todas las decisiones de producto
- La pantalla v3 ACTUAL: apps/web/app/(app)/shared/(home)/page.tsx (el hero navy)
- Baseline v2 (evidencia, NO copiar literal): grana-v2/docs/specs/economia-familiar/*.html
- Convención visual: docs/design/dashboard/ y docs/design/cards/ (tokens, shared.css)

## Modelo a respetar (resumido)
Compartido son las TRES LENTES de Grana proyectadas al hogar:
- CONSUMO  "¿en qué gastaron juntos?" → base DEVENGADO (por fecha de compra; cuotas
           mes a mes). Muestra el TOTAL del hogar (las dos partes).
- CAJA     "¿qué se deben hoy?"        → saldo actual de una CUENTA CORRIENTE entre
           los dos, reloj de IMPACTO (la deuda nace cuando la plata se mueve).
- COMPROMISO "¿qué se viene?"          → tramo "por venir" de la misma cuenta corriente
           (cuotas/resúmenes futuros aún no impactados).

Principios duros:
- Bimoneda SIEMPRE visible (ARS y USD nunca se mezclan ni se esconden, ni en cero).
- En el gasto del mes, el NETO es protagonista; bruto y reintegros van como dato
  informativo ("costo neto $130.373 · gastaron $145.800, lograron $15.427 en reintegros").
- Voz relacional CON monto exacto ("Están casi al día — queda $1.250 a favor de Caro").
  Precisión contable innegociable; el tono se suaviza, el número nunca se aproxima.
- Microcopy MUY explicativo (pilar de confianza contable): cada cifra debe poder
  responder "¿de dónde sale?". Especialmente el desfasaje gasto-devengado vs deuda-impacto.
- Responsive (web). El layout tiene que poder portarse a mobile después (lo hace otro
  equipo), así que pensá ambos anchos.

## CONSERVAR (pedido explícito del usuario)
El despliegue inline de categorías del hero actual ("En qué gastaron" → tocás una
categoría y se abren los movimientos) le gusta mucho. NO lo descartes. Es candidato
a conservarse tal cual. Lo único que tiene que SALIR del hero navegable es la DEUDA
(pasa a la cuenta corriente, fija en "hoy").

## Pantallas y variantes pedidas

### 1. HOME de Compartido — AL MENOS 4 variantes
Datos a mostrar: saldo entre los dos (ARS+USD, voz relacional, CTA saldar) · gasto
del mes (neto protagonista + navegador de mes) · "En qué gastaron" por categoría con
expand inline y selector ARS/USD · acceso a la cuenta corriente · últimos movimientos.
Recorré un ESPECTRO en las 4+ variantes:
- (mínima) conservar el hero navy + expand casi igual, solo sacar la deuda a su propia
  franja "hoy" y agregar USD al desglose;
- (intermedias) reordenar en bloques de las tres lentes con identidad visual fuerte;
- (audaz) tabs o un solo scroll con la cuenta corriente como centro.
Mostrá claramente qué responde al navegador de mes (solo la actividad) y qué no
(deuda y proyección, siempre "hoy").

### 2. CUENTA CORRIENTE — AL MENOS 4 variantes (es nuevo, no existe)
Un libro que corre entre las dos personas, por moneda: cada gasto compartido suma la
parte del otro, cada reintegro y liquidación resta, con saldo corriente. Arriba de
"hoy" = ya impactado (saldo real); abajo = compromisos por venir (cuotas/resúmenes
futuros). Las reversiones son CONTRAASIENTOS, nunca borrados.
Explorá en las variantes: tramo "por venir" mezclado con una línea "hoy" vs sección
aparte; formato lista/extracto vs tarjetas; cómo se ve la composición ("de dónde sale
el saldo") y el estado de cada liquidación (enviada-pendiente / completada / revertida).

### 3. SALDAR DEUDA — AL MENOS 3 variantes
Datos: deuda actual (por moneda) · monto (con botón "Total" y pago parcial) · cuenta
de origen CON su saldo disponible · deuda restante después del pago · AVISO no
bloqueante si la cuenta queda negativa. Más el lado del receptor (asignar cuenta donde
entró la plata) y un recibo de "completada".

### 4. ALTA DE GASTO COMPARTIDO (toggle + split) — AL MENOS 3 variantes
Datos: toggle "Compartir / Dividir con {nombre}" dentro del form de gasto · editor de
split (% por persona, default del hogar, editable) · preview del MONTO de cada parte ·
anotación pedagógica ("el gasto impacta tu saldo; la parte de Caro ($X) se registra
como deuda a tu favor"). El reto: incluir la anotación y el preview SIN recargar el form.

## Formato de entrega
HTML estático por pantalla (web + nota de adaptación mobile), siguiendo los tokens de
docs/design/*/shared.css. Etiquetá cada variante (V1, V2…) con una línea de racional.
</content>
