# Mocks de producto — modelo de dinero

Simulación de pantallas del modelo de `docs/modelo-de-dinero.md`, fase por fase. Abrir los `.html`
en el navegador.

| Archivo | Fase | Estado |
|---|---|---|
| `fase-1-guardar.html` | 1 · Guardar | Completo — es la fase que implementa `add-savings-set-aside` |
| `fase-2-proposito.html` | 2 · Propósito | Completo — cuatro pantallas, dos de ellas son la fase 1 con un campo más |
| — | 3 · Posiciones | Pendiente — tiene una decisión abierta que el mock existe para resolver |
| — | 4 y 5 | No se mockean todavía: dibujar el detalle de una meta o la pantalla de patrimonio sería inventar decisiones que no están tomadas, y un mock convincente de algo no decidido termina implementándose tal cual |

**No es diseño final.** Es referencia de producto: qué pantalla responde qué pregunta, qué se
reutiliza y qué hay que construir. Los mocks están redibujados sobre el lenguaje visual real de la
app —segmented de tipos, card de monto con chip de moneda, filas con tile + label small-caps +
chevron, botón emerald, hero navy, filas de movimiento con avatar redondo— tomado de capturas de
producción de agosto de 2026. El HTML **no es código de producción**.

## Reemplaza a `docs/design/savings-guardar/`

Aquel circuito quedó obsoleto en tres puntos, todos por la misma causa: modelaba el plazo fijo como
una **cuenta fuera del disponible**.

- Sus pantallas 6, 7 y 8 (alta de cuenta con "tipo de vehículo", transferencia al plazo fijo,
  Cuentas en dos bloques con "Fuera de disponible") desaparecen: en el modelo corregido un plazo
  fijo es una **posición**, y la fase 1 no toca Cuentas.
- Tenía la línea *"Pasaste a otras cuentas"*, que existía solo porque con cuentas fuera del
  disponible las transferencias entre cuentas propias dejaban de ser neutras.
- Su pantalla 8 agrupaba Cuentas por tipo. `/accounts` hoy **no muestra ningún total**, así que no
  hay dos números que reconciliar y la fase 1 no necesita tocarla.

## Decisiones abiertas que los mocks tienen que resolver

**Fase 3 — la segunda línea bajo la regla.** Cuando aparezcan las posiciones, el "Resumen del mes"
necesita una línea hermana de *Guardaste este mes* —algo como *Pusiste a trabajar*— para que
`Tenías` se siga derivando bien y la card no reescriba el pasado. Es prima hermana de la línea
*"Pasaste a otras cuentas"* que ya fue rechazada una vez; la diferencia es que aquella hablaba de
plata moviéndose entre dos bolsillos propios y esta habla de un acto que el usuario decidió. Se
juzga mirando la pantalla, con las dos versiones al lado.

**Fase 3 — dónde entra "Invertir".** El segmented de registrar movimiento ya tiene cinco tabs
(Gasto · Ingreso · Transferencia · Ajuste · Cambio) y llena el ancho de un teléfono. Una sexta no
entra sin rediseñar el control.
