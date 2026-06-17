## Context

El onboarding actual (welcome → initial-balance → done) es funcional pero el tono es corporativo. Dice "We'll ask you a couple of questions so the app fits you", pero el usuario nuevo en finanzas tiene ansiedad real: ¿Los números tiene que ser exactos? ¿Voy a romper algo?

El diseño propone reescritura de copy con tono Grana: amigable, cotidiano, que baje ansiedad mediante validación de la vida real ("La vida real rara vez cierra perfecto") y promesa clara (ARS y USD separados, control sin drama).

Además, el cierre del onboarding (`done`) deja de soltar al usuario en un dashboard vacío sin rumbo: incorpora una **bifurcación de modo de uso ("Tu Grana, tu decisión")** que materializa el modelo mental novato/experto del proyecto. El usuario elige entre llevar todo en una billetera (simple) o personalizar sus cuentas reales (detalle), y la app lo rutea al primer paso de cada camino (alta de movimiento con tour / alta de cuenta). Es la evolución del CTA único que este diseño planeaba originalmente.

El flujo del wizard (welcome → initial-balance → done) no cambia en cantidad de pantallas: el fork vive **dentro** de `done`, no agrega pantallas nuevas.

## Goals / Non-Goals

**Goals:**
- Comunicar propuesta de valor de Grana en el onboarding (separación ARS/USD, punto de partida real)
- Bajar ansiedad del usuario nuevo mediante tono que valida incertidumbre
- Cerrar el onboarding con una decisión accionable (billetera vs cuentas) que evite el "dashboard vacío sin rumbo" y rutee al primer paso de cada camino
- Establecer canon español (voz nace en ES, se traduce)

**Non-Goals:**
- Agregar pantallas nuevas al wizard (el fork vive dentro de `done`)
- Persistir un "modo de usuario" o reconfigurar la UI del resto de la app según la elección (la elección es solo ruteo; el modo persistente es un follow-up aparte)
- Implementar hints contextuales (eso es Change 2)
- Implementar alta de movimiento en mobile ni portar la bifurcación a mobile (pendiente para cuando exista flujo nativo)
- Cambiar lógica de datos o gates del onboarding
- Construir el tour del primer movimiento (vive en su propia change `first-movement-tour`; acá solo ruteamos hacia él)

## Decisions

**D1: No agregar alta mínima de movimiento en mobile**

*Alternativas consideradas:*
- A1: Incluir formulario mínimo de movimiento mobile → Aumenta scope significativamente (cuenta, tipo, moneda, categoría, fecha, warnings, tarjetas). Toca reglas contables centrales. No corresponde como apéndice de change de onboarding.
- A2: Deshabilitar CTA en mobile → Muestra botón roto/deshabilitado. Mala UX.
- **A3: Conservar CTA a dashboard en mobile, documentar para Change 2 (ELEGIDA)**

*Rationale:* Mantiene scope enfocado en lo que queremos validar (tono, claridad). Alta de movimiento toca reglas contables = debe ser su propia change, con specs propias. Mobile recibe CTA equivalente cuando el flujo nativo exista.

**D2: Cierre diferenciado por plataforma — fork en web, CTA simple en mobile**

Web `done` (bifurcación "Tu Grana, tu decisión"):
```
[ A · Una billetera y listo ]   [ B · Mis cuentas, al detalle ]
   → /dashboard?nuevo=1              → /accounts?nuevaCuenta=1
   (drawer movimiento + tour)        (drawer alta de cuenta)
Sin escape: hay que elegir A o B.
```

Mobile `done`:
```
CTA principal: "Ir al dashboard"
(Sin fork: depende del drawer web; el alta de movimiento nativa no existe)
```

*Rationale:* Web tiene los dos flujos funcionales (drawer de movimiento + drawer de alta de cuenta), mobile no. El fork le da rumbo al usuario web en el peor momento (dashboard vacío). No hay escape: el cierre del onboarding existe justamente para empujar el primer paso; ambos caminos dejan `onboarding_completed_at` ya marcado, así que aunque el usuario abandone el drawer, el onboarding quedó completo. Mobile se mantiene honesto con el estado del producto.

**D6: El fork es la sección de cierre de `done`, no una pantalla nueva (Camino 1)**

*Alternativas:*
- A1: Pantalla nueva después de `done` → suma una 4ª pantalla y choca con el non-goal "no agregar pantallas".
- **A2: `done` ya marca completado + muestra resumen; su sección de CTA se convierte en las dos cards (ELEGIDA).**

*Rationale:* `done` ya es el "momento de cierre". Reusar su chrome evita una pantalla extra y unifica el trabajo en un solo dueño.

**D7: Confirmación cálida que reemplaza la pantalla (no navegación directa)**

Al tocar una card, `done` NO navega de inmediato: muestra un mensaje de confirmación ("¡Genial! Arranquemos por tu primer movimiento." / "¡Te gusta el detalle! Vamos a crear tu primera cuenta.") con un botón "Vamos 🚀" (+ "Volver") que recién entonces rutea. La confirmación **reemplaza toda la pantalla** (oculta el header de éxito y el resumen de saldo) para quedar enfocada en un solo mensaje. Por eso el componente client es dueño de toda la pantalla `done` (header + saldo + fork), no solo de la sección de cards.

*Rationale:* El usuario pidió ese latido de calidez explícito; refuerza la sensación de que la app "lo entiende" y da una micro-pausa antes del salto de contexto. Que tape el header/saldo evita el ruido visual de "felicitación + decisión" apilados.

**D8: Puente query-param para abrir los drawers (no son rutas)**

Tanto el alta de movimiento como la de cuenta se presentan en **drawers** (estado client), no en rutas. El onboarding vive en otro route group, así que no puede abrirlos directo. Solución gemela para ambos caminos: navegar a la ruta de la lista correspondiente con un query param que un consumidor dentro de `(app)` lee y usa para abrir el drawer, limpiando el param para no re-disparar:
- **A** → `/dashboard?nuevo=1` → `MovementDrawerProvider` dispara `openCreate()`.
- **B** → `/accounts?nuevaCuenta=1` → `CreateAccountButton` abre su drawer (espera a que carguen las instituciones antes de abrir).

*Rationale:* Menor acoplamiento posible entre route groups, y presentación 100% consistente (todo en drawer). El gate del tour ya es `showFirstMovementGuidance = !hasAnyTransaction`, así que el usuario A sin movimientos ve el tour sin trabajo extra. Resuelve la Open Question #1 del diseño original.

**D9: La elección es solo ruteo, sin modo persistente**

La elección A/B no escribe ninguna preferencia ni cambia qué UI se muestra después. El "modo de usuario persistente que esconde features" (ver memoria `modo-usuario-modelo-mental`) queda como follow-up aparte y discutible.

*Rationale:* Mantiene el scope acotado y reversible. Esconder features para siempre por una decisión de día 1 es una decisión de producto grande que merece su propio diseño.

**D3: Canon español, traducción EN**

Copy propuesto en español primero:
- "Vamos a ordenar tu plata sin convertir esto en una planilla eterna."
- "Sin juicio, sin drama."
- "La vida real rara vez cierra perfecto."
- "que los gastos misteriosos den la cara."

Luego se traduce a EN. La voz nace en ES porque ese es el usuario real.

*Rationale:* Evita que humor/tono se pierda en traducción inversa. Copy sensible en finanzas nace donde se habla el idioma.

**D4: Onboarding completado ANTES de elegir CTA**

En `done.tsx` (web y mobile):
1. Marcar `onboarding_completed_at` en profiles
2. Mostrar pantalla con resumen
3. Usuario elige CTA (movimiento en web, dashboard en mobile)

*Rationale:* Clean arquitectura de datos. No acopla gates a CTAs. Si usuario abandona después de done, ya está registrado como "completó onboarding". El CTA es navegación, no condición.

**D5: Un guiño máximo por pantalla**

- Welcome: "sin convertir esto en una planilla eterna"
- Initial Balance: "La vida real rara vez cierra perfecto"
- Done: "que los gastos misteriosos den la cara"

*Rationale:* Finanzas tiene ansiedad real. Humor baja esa ansiedad pero si se pasa, rompe confianza. Condimento, no protagonista.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Mobile siente menos "empoderado" con CTA a dashboard vs movimiento | Aceptable por ahora. Change 2 (cuando exista alta mobile) lo soluciona. Es arquitectura honesta. |
| Traducción EN puede perder matices del humor español | Traducción a cargo de quien entienda tono Grana. Revisar con stakeholders. |
| Usuario sigue sin descubrir features (Cards, Shared) | Esperado. Change 2 (hints contextuales en dashboard) lo cubre. Onboarding obligatorio = setup, hints = discovery. |
| El usuario se siente forzado a elegir billetera vs cuentas | Decisión de producto deliberada: el cierre del onboarding existe para empujar el primer paso. `onboarding_completed_at` ya quedó marcado, así que abandonar el drawer no lo traba. Siempre puede "Volver" entre las dos cards. |
| Los drawers no abren si su provider/datos no cargaron al leer el param | El param sobrevive en la URL hasta que el consumidor está listo: A espera el montaje del `MovementDrawerProvider`; B espera a que carguen las instituciones (`disabled` flips false). No se pierde la intención. |
| Camino B: el usuario crea la cuenta y queda sin guía propia | Aceptado por ahora. Una guía para el alta de cuenta es follow-up; B aterriza en un drawer ya existente y usable. |

## Open Questions

1. ¿El copy en mobile debe estar en i18n del app nativo o duplicado? (Asumir: mismo i18n, con `useT()` y fallback en español)
2. ¿El nombre exacto de la cuenta por defecto ("Billetera") que el usuario ve coincide con el copy de la Card A? (Confirmar en implementación para que "tu billetera ya está creada" sea literal.)
