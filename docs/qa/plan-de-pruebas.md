# Plan de pruebas funcional — Grana v3

Documento vivo. Reemplaza el enfoque por "instancias" de `instancia-01-base-funcional.md`
(que queda como borrador de origen). Acá los casos se organizan **por módulo** y dentro
de cada módulo por **nivel**, del happy path a los casos inusuales / borde.

- **Versión del doc:** 2026-06-03 (cierre tanda 2: datasets reforzados para todo lo pendiente)
- **Referencia contable de la suite:** `2026-06-03`, zona `America/Argentina/Buenos_Aires`
- **Alcance:** web completo. Mobile solo en casos marcados `cross-platform` (la paridad
  mobile está diferida; no se trata como defecto salvo que el caso lo indique).

---

## Cómo usar este documento

1. Cargá el **dataset base** (sección "Datos") una vez por corrida; los módulos asumen ese estado.
2. Ejecutá los casos en orden de nivel dentro de cada módulo. Cada caso tiene un **ID estable**
   para reportar defectos.
3. Marcá la columna **Estado** y dejá una nota si hay observación. Yo (la IA) actualizo este
   archivo con tu feedback: paso casos a ❌/⚠️, agrego casos nuevos que surjan y registro los
   fixes en el **Registro de cambios** del final.

### Leyenda de estado

| Símbolo | Significado |
|---|---|
| ⬜ | Pendiente de ejecutar |
| ✅ | Pasó |
| ❌ | Falla (defecto abierto) |
| ⚠️ | Pasa con observación / menor |
| 🔧 | En fix (hay branch/commit) |
| ⛔ | No aplica en esta versión |

### Niveles

- **N1 · Básico** — happy path, lo que un usuario hace siempre.
- **N2 · Intermedio** — variantes, edición, validaciones, filtros.
- **N3 · Avanzado / inusual** — bordes contables, errores, RLS, responsive, concurrencia.

---

## Capacidades vigentes (qué se puede y qué no)

Esto evita escribir casos imposibles (aprendizaje del doc anterior):

- **Cuentas:** desde "crear cuenta" **solo se crean Bancarias/débito**. La única cuenta de
  **Efectivo** es la `Billetera` que provisiona el onboarding. → Para probar borrado de cuenta
  sin historial se usa una **cuenta bancaria** descartable, no una de efectivo.
- **Dinero (input):** los miles se agrupan solos con punto al tipear (`1.000`). El **decimal se
  carga con coma `,` o con la tecla `.`** (incl. la del teclado numérico): al tipear, el `.` se
  mapea al separador decimal `,` (un numpad sin coma ya no produce un entero 100× más grande).
  El **pegado** sigue tratando el `.` como miles (pegar `1.000` = 1000).
- **Dinero (display):** con "Mostrar centavos" ON, ARS y USD muestran **siempre 2 decimales**.
- **Bimoneda:** todo usuario arranca con ARS + USD. No se suman ni se convierten entre sí.
- **Saldo inicial:** se persiste como `initial_balance`; **no** crea un movimiento falso.
- **Errores:** siempre localizados; nunca texto crudo de Supabase/Postgres.

---

## Datos

### Identidades

Reemplazar `<RUN>` por un id de corrida (ej. `20260602a`) y `<DOM>` por un dominio real que
reciba aliases `+`.

| Alias | Email | Password | Uso |
|---|---|---|---|
| QA-A | `qa.grana+<RUN>.a@<DOM>` | `GranaQA2026!` | Usuario principal confirmado |
| QA-U | `qa.grana+<RUN>.u@<DOM>` | `GranaQA2026!` | Usuario sin confirmar |
| QA-R | `qa.grana+<RUN>.r@<DOM>` | `GranaQA2026!` | Recuperación de password |
| QA-B | `qa.grana+<RUN>.b@<DOM>` | `GranaQA2026!` | Segundo miembro (Compartido) |

> Para resetear un usuario y volver a probar el onboarding desde cero, ver
> `memory/qa-user-reset-sql.md` (borra `auth.users`; cuidado con las FKs RESTRICT).

### Dataset de cuentas (estado tras el setup de QA-A)

| Cuenta | Tipo | Institución | ARS | USD | Cómo se crea |
|---|---|---|---:|---:|---|
| Billetera | Efectivo | — | `125.000,50` | `250,00` | Auto (onboarding) |
| Galicia sueldo | Bancaria | Galicia | `450.000,00` | `1.000,00` | Alta manual |
| Cooperativa ahorro | Bancaria | Cooperativa Barrio Norte (custom) | `0,00` | `0,00` | Alta manual + institución custom |
| Cuenta descartable | Bancaria | cualquiera | `0,00` | `0,00` | Alta manual, **sin movimientos**, para borrar |

**Institución custom:** nombre `Cooperativa Barrio Norte`, color `#3A7D44`, icono `wallet`.

**Totales esperados sin movimientos:** ARS `$ 575.000,50` · USD `u$s 1.250,00`.

### Dataset para tarjetas (módulo Tarjetas)

| Campo | Valor |
|---|---|
| Nombre | `Visa Galicia` |
| Red | Visa |
| Límite | `500.000` (ARS) |
| Cierre período actual | `28/06/2026` |
| Vencimiento período actual | `07/07/2026` |
| Cierre período siguiente | `28/07/2026` |
| Vencimiento período siguiente | `06/08/2026` |

> Las fechas cumplen las validaciones del wizard (vencimiento > cierre; siguiente > actual) y
> dejan la fecha de referencia de la suite **dentro del período actual** → un consumo de hoy
> cae en el período actual (lo que CARD-N1-02 espera).

**Segunda tarjeta — para pago de resumen (CARD-N2-03 / N3-01).** La Visa Galicia no sirve
para probar el pago hasta fin de mes (su período no cerró). Esta se crea con el período
actual **ya cerrado** (el wizard acepta cierres hasta 40 días atrás):

| Campo | Valor |
|---|---|
| Nombre | `Master QA Pagos` |
| Red | Mastercard |
| Límite | `300.000` (ARS) |
| Cierre período actual | `01/06/2026` (**ya cerrado**) |
| Vencimiento período actual | `10/06/2026` |
| Cierre período siguiente | `01/07/2026` |
| Vencimiento período siguiente | `10/07/2026` |
| Consumo para generar deuda | gasto `10.000,50` ARS **retro-fechado al `28/05/2026`** (cae en el período cerrado) |

> Con eso el período cerrado tiene deuda y el botón de pagar se habilita **hoy** (el pago
> exige período cerrado o vencido). El monto con centavos es a propósito: CARD-N2-03
> verifica que el centavo no se pierda.

### Dataset para movimientos (módulo Movimientos)

> Las categorías deben ser las del **seed del sistema** (Comida, Transporte, Sueldo, etc.).
> ⚠️ La versión anterior decía "Alimentos"/"Ingresos", que **no existen** — corregido.

| Concepto | Tipo | Cuenta | Moneda | Monto | Categoría / Subcategoría |
|---|---|---|---|---:|---|
| Sueldo | Ingreso | Galicia sueldo | ARS | `800.000` | Sueldo |
| Supermercado | Gasto | Billetera | ARS | `45.500,75` | Comida / Supermercado |
| Ahorro USD | Ingreso | Galicia sueldo | USD | `300` | Inversiones |
| Transferencia | Transferencia | Galicia → Billetera | ARS | `50.000` | — |

### Dataset para spending-by-category (módulo 11) — números redondos verificables

Cargar estos 4 gastos ARS **en el mes corriente** (además del dataset anterior). Los `%`
esperados valen si estos son los únicos gastos del mes en esas categorías; si hay otros,
validar contra los **montos**, no contra los %.

| Concepto | Categoría / Sub | Monto | Cuenta |
|---|---|---:|---|
| Súper redondo | Comida / Supermercado | `10.000` | Billetera |
| Restaurante | Comida / Restaurante | `5.000` | Billetera |
| Nafta | Transporte / Nafta | `4.000` | Galicia sueldo |
| Cine | Entretenimiento / Cine | `1.000` | Billetera |

**Esperado del set (total `20.000`):** Comida `15.000` (75%) · Transporte `4.000` (20%) ·
Entretenimiento `1.000` (5%). Desglose Comida: Supermercado `10.000` / Restaurante `5.000`.

### Dataset para recurrencias y reintegros

| Pieza | Valor |
|---|---|
| Regla recurrente | "Gimnasio", gasto mensual `15.000` ARS, Billetera, categoría Salud, `start_date` = hoy |
| Regla custom | "Verdulería", gasto cada `10` días, `5.000` ARS, Billetera, Comida |
| Gasto con reintegro | "Farmacia", `20.000` ARS, Billetera, Salud/Farmacia, reintegro esperado `10.000` |
| Conciliación | monto real `9.500` (REI-N2-01) · tope `12.000` (REI-N2-02) · real `25.000` > gasto (REI-N3-01) |

### Dataset para Compartido (módulo 12 — requiere QA-B registrado)

| Pieza | Valor |
|---|---|
| Gasto compartido ARS | "Cena", `10.000` ARS, Billetera de QA-A, split 50/50 → deuda QA-B→QA-A `5.000` |
| Gasto compartido USD | "Streaming anual", `100` USD, Galicia de QA-A, split 50/50 → deuda USD `50` separada |

---

## Módulo 1 — Autenticación

OTP de 8 dígitos, sin magic link. Mensajes localizados; sin filtrado de información.

> **Corrida de usuario nuevo:** este módulo + Onboarding + DASH-N3-02 se ejecutan juntos al
> registrar QA-B (que además habilita el módulo Compartido). Para re-probar con QA-A, resetear
> según `memory/qa-user-reset-sql.md` (cuidado FKs RESTRICT: `period_payments` y Compartido).

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| AUTH-N1-01 | Signup + OTP válido | QA-A, `Ana Base` | Signup → completar → enviar → leer inbox | Navega a verify con email precargado; email con **OTP de 8 dígitos**, sin link; no hay sesión aún | ⬜ | |
| AUTH-N1-02 | Verificación one-shot | QA-A | Ingresar OTP → confirmar | Cuenta confirmada; **sign out inmediato**; login muestra "cuenta confirmada" **una sola vez** (al volver ya no aparece) | ⬜ | |
| AUTH-N1-03 | Login → onboarding | QA-A | Login | Sesión creada; como no completó onboarding, redirige al **wizard**, no al dashboard | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| AUTH-N2-01 | OTP con formato inválido | QA-A en verify | Ingresar `1234567` y luego `1234A678` | Ambos rechazados por validación local; sin sesión; permanece en pantalla | ⬜ | |
| AUTH-N2-02 | Cuenta duplicada | email QA-A | Reintentar signup con mismo email | Informa "usuario ya existe"; no navega a verify; no reenvía email | ⬜ | |
| AUTH-N2-03 | Email no confirmado + resend | QA-U (registrado, sin OTP) | Login con QA-U → activar reenvío inline | Mensaje específico "email no confirmado"; aparece acción de reenvío; navega a verify con email cargado; **cooldown 60s** y botón deshabilitado | ⬜ | |
| AUTH-N2-04 | Cooldown de resend | QA-U en verify | Observar botón → esperar a 0 → reenviar | Durante cooldown deshabilitado con segundos; a 0 se habilita; tras reenvío vuelve a 60s | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| AUTH-N3-01 | Credenciales inválidas no filtran info | QA-A + pass mala; email inexistente | Login en ambos | Mismo mensaje genérico localizado; sin sesión; en web la URL **no** recibe `?error=...` | ⬜ | |
| AUTH-N3-02 | Recovery por OTP sin magic link | QA-R (confirmado) | forgot-password → OTP → nuevo pass `GranaQA2026.New!` | Email con OTP de 8 dígitos, sin link; cambia el pass; login con pass viejo falla, con nuevo funciona | ⬜ | |
| AUTH-N3-03 | reset-password directo sin sesión recovery | — | Abrir `/reset-password` sin sesión recovery | Middleware bloquea el form; redirige al entry point del recovery | ⬜ | |

---

## Módulo 2 — Onboarding

Wizard no salteable; provisión bimoneda; saldo inicial sin movimiento falso.

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ONB-N1-01 | Carga de saldo actual | ARS `125.000,50`, USD `250,00` | welcome → saldo → cargar ambos → done | Permite ambos ledgers; done muestra resumen; marca onboarding completo y navega a dashboard | ⬜ | |
| ONB-N1-02 | Billetera provisionada | — | dashboard → Cuentas → Billetera | Existe **una** cuenta cash `Billetera`; ARS y USD activos; saldos `$ 125.000,50` y `u$s 250,00` | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ONB-N2-01 | Separador de miles al tipear | USD | En saldo USD tipear `1` y tres ceros | Muestra `1.000` (= 1000 USD); con cuatro ceros `10.000`; **nunca** aparece un decimal fantasma (regresión del fix) | ⬜ | |
| ONB-N2-02 | Decimal con coma **o punto** | ARS | Tipear `125000,50`; luego probar `125000.50` (con la tecla `.`) | Ambos muestran `125.000,50`: la coma y la **tecla `.` (numpad)** producen el decimal. Pegar `1.000` sigue siendo 1000 (punto = miles solo en paste) | ⬜ | Cambio de comportamiento: antes el `.` tipeado se trataba como miles; ahora mapea a decimal (fix `0de436d`). |
| ONB-N2-03 | Saldo inicial no genera movimiento | — | Tras onboarding, abrir movimientos de Billetera | Lista de movimientos **vacía**; el saldo viene de `initial_balance`, no de una transacción | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ONB-N3-01 | Wizard no salteable | QA-A autenticado sin onboarding | Intentar ir a `done` sin completar saldo | No permite saltar; vuelve al paso pendiente | ⬜ | |
| ONB-N3-02 | Saldo cero válido | ARS `0` | Completar con `0` en ARS | Acepta `0` como válido; onboarding completa | ⬜ | |

---

## Módulo 3 — Cuentas

Creación **solo bancaria**; institución custom; herencia de avatar; guardas de moneda.

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ACC-N1-01 | Alta de cuenta bancaria bimoneda | `Galicia sueldo`, Galicia, ARS `450.000`, USD `1.000` | Cuentas → crear → completar → guardar | Aparece en **Bancarias**; avatar con branding Galicia; ARS y USD por separado | ✅ | OK funcional. Observación de UX: ver ACC-N1-OBS (afordances de editar/eliminar y consistencia drawer vs ruta). |
| ACC-N1-02 | Lista agrupada, sin tarjetas | — | Abrir `/accounts` | Sección **Efectivo** (Billetera) y **Bancarias** (Galicia); filas con avatar/nombre/saldos/acción; tarjetas de crédito **no** están acá | ✅ | OK funcional. Observación de UX en ACC-N1-OBS. |
| ACC-N1-OBS | Afordances de editar/eliminar (UX) | — | `/accounts` y detalle de cuenta | (1) Fila: "Editar" texto → **ícono lápiz**. (2) Detalle: Editar/Archivar/Eliminar texto → **iconos** (lápiz/archivo/papelera). (3) **Inconsistencia:** "Editar" en la fila iba a la ruta `/edit` mientras el detalle abría drawer → ahora **ambos abren el mismo drawer** (drawer everywhere; `/edit` queda como fallback no-JS). (4) Eliminar sigue solo en el detalle (correcto). | 🔧 | Resuelto en `996bacf`. Pendiente verificación visual del usuario. |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ACC-N2-01 | Crear **solo** permite Bancaria/débito | — | Abrir "crear cuenta" | **No** existe opción Efectivo; el form es bancario; el nombre es **opcional** (hereda del banco) | ✅ | OK. |
| ACC-N2-02 | Institución custom desde el form | `Cooperativa Barrio Norte`, `#3A7D44`, `wallet` | En alta, crear institución desde el selector → crear `Cooperativa ahorro` | La institución queda disponible solo para QA-A; la cuenta usa el branding custom (color + icono) | ✅ | OK. |
| ACC-N2-03 | Editar institución → avatar heredado en vivo | `Galicia sueldo` sin override | Editar → cambiar institución a Cooperativa Barrio Norte → guardar | Conserva nombre; el avatar pasa al branding nuevo por herencia, sin override manual | 🔧 | Edición funciona, pero el selector no abría el listado al click (había que borrar la institución actual primero). Resuelto en `078ba85`: el dropdown abre al click y lista todas las instituciones para cambiar. |
| ACC-N2-04 | Borrar cuenta bancaria sin historial | `Cuenta descartable` (bank, sin movimientos) | Crear → detalle → eliminar | La UI ofrece **Eliminar** (no Archivar); borrado permanente; desaparece de la lista | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ACC-N3-01 | No desactivar moneda con saldo ≠ 0 | Billetera USD `250` | Editar Billetera → intentar desactivar USD | Rechazado; USD sigue activa; mensaje **localizado** que orienta | ⛔ | No aplica: por decisión de **bimoneda por defecto** no hay UI para desactivar monedas en ninguna cuenta; ARS+USD están siempre activas. El invariante "USD sigue activa" se cumple por diseño (no por un guard de rechazo). |
| ACC-N3-02 | Archivar cuenta **con** movimientos | Galicia (con movimientos) | Detalle → acción | La UI ofrece **Archivar** (no Eliminar); al archivar puede reactivarse | ✅ | OK. |
| ACC-N3-03 | Botón "agregar movimiento" es de la librería | dentro de una cuenta | Abrir detalle de cuenta | El botón usa el componente `Button` (primario emerald + ícono), consistente con el dashboard | 🔧 | El botón del **empty-state** ("Todavía no hay movimientos") era **negro** (`bg-primary` crudo). Resuelto en `16a1364`: ahora usa el `Button` (emerald + ícono Plus). Afecta empty-state en detalle de cuenta y en transactions. |
| ACC-N3-04 | Nombre demasiado largo | >50 chars | Intentar guardar | Validación localizada; no persiste | ✅ | El input corta en 50 chars (`maxLength`), no deja exceder al tipear → válido/mejor que validar al guardar. |

---

## Módulo 4 — Dashboard

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| DASH-N1-01 | Hero bimoneda contra dataset | dataset base sin movimientos | Abrir dashboard | ARS `$ 575.000,50` y USD `u$s 1.250,00`; ARS primario, USD subordinado; sin conversión ni total unificado | ✅ | Importes difieren del doc solo por dataset distinto cargado en esta corrida; lógica bimoneda OK. |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| DASH-N2-01 | Toggle del ojo | — | Activar ojo → recorrer → salir a Cuentas y volver | Enmascara importes sin ocultar labels; **el estado persiste** (navegación + recarga) hasta que el user lo vuelva a cambiar | 🔧 | **Cambio de producto** (antes: "no persiste fuera del dashboard"). El estado vivía en estado local del dashboard → se reseteaba al volver. Resuelto en `d8f2644`: persiste como cookie per-device (como sidebar/centavos); el server renderiza el estado correcto sin flash de importes reales. |
| DASH-N2-02 | Hero con datos (ambas monedas) | al menos **un movimiento ARS** y **uno USD** (el tipo da igual: ej. gasto Súper 45.500,75 ARS + ingreso Ahorro 300 USD en Galicia) | Volver al dashboard | El hero ARS varía por el movimiento ARS y el USD por el USD, **cada ledger por separado**; nunca se suman ni convierten | ⬜ | Caso reescrito: antes pedía verificar "por moneda" pero el dataset sugerido era solo ARS → no se podía comprobar la separación. Lo que importa es tener 1 movimiento por moneda; ingreso o gasto es indistinto. |
| DASH-N2-03 | Navegador de mes | meses con/sin datos | Usar prev/next | Cambia el período; deshabilita extremos sin datos | ✅ | El navegador de mes vive **dentro del gráfico de balance mensual** (no es un control global aparte). Funciona OK. |
| DASH-N2-04 | Bimoneda en "Balance del mes" y "En qué se fue" | movimientos ARS y USD del mes | Cargar gasto USD y mirar ambas secciones | Ambas muestran el USD por separado del ARS, sin sumar ni convertir | 🔧 | **Bug encontrado:** "Balance del mes" filtraba solo ARS (la query con `.eq('currency_code','ARS')`) y "En qué se fue" descartaba el USD que la query ya devolvía → el gasto USD no aparecía (aunque "Para gastar" sí lo reflejaba). Resuelto en `a00b32f`: gráfico de doble eje (ARS izq, USD der punteado) + totales USD subordinados; teaser con lista USD subordinada. USD se muestra solo si hay actividad USD. |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| DASH-N3-01 | Desktop vs mobile-web | `1440x900` y `390x844` (o emulación de un teléfono en DevTools) | Abrir en ambos | Desktop: hero arriba + dos columnas, **sin FAB**, "Nuevo movimiento" en header. Mobile-web: secciones apiladas, **FAB** y sin botón en header | 🔧 | Botones OK en ambos viewports. Defecto menor: en mobile el navegador de mes partía el año a una segunda línea ("junio" / "2026"). Resuelto en `74c9a4b` (`whitespace-nowrap`; el título de la card trunca). |
| DASH-N3-02 | Tarjeta de bienvenida (sin movimientos) | usuario nuevo | Dashboard recién onboarded | CTA "primer movimiento" usa el componente `Button` | ⬜ | Pendiente: se ejecuta cuando se registre un usuario nuevo (junto con Auth/Onboarding). |

---

## Módulo 5 — Settings e i18n

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SET-N1-01 | Toggle de centavos | — | Settings → desactivar centavos → dashboard → reactivar y recargar | Oculta/muestra centavos según preferencia; **persiste** tras recargar; el ledger no cambia | ✅ | OK. |
| SET-N1-02 | Centavos ON muestra 2 decimales | ARS con decimales | Activar centavos | ARS muestra **2 decimales** siempre (ej. `$ 125.000,50`), no uno solo (regresión del fix) | ✅ | OK. |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SET-N2-01 | Cambio de idioma a inglés | — | Cambiar a English → recorrer dashboard/Cuentas/Movimientos/Settings → recargar | Labels de producto en inglés; **nombres cargados por el usuario** (ej. `Galicia sueldo`) y **categorías propias** no se traducen; las **categorías/subcategorías de sistema SÍ** se traducen en todos los displays; persiste (web: cookie) | ✅ | Resuelto con el change `translate-system-categories-display` (merge squash `dcbfd28`): canonical_name+user_id por el contrato de datos y label resuelto vía i18n en lista, detalle, filtros, form, spending, cuotas, recurrencias, reintegros y compartido. Verificado en app. |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SET-N3-01 | Idioma no sincroniza entre plataformas | web + mobile | Cambiar en web | Web usa cookie, mobile SecureStore; cambiar una **no** afecta la otra | ⬜ | cross-platform |

---

## Módulo 6 — Navegación / Shell

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHELL-N1-01 | Navegación desktop | `1440x900` | Recorrer Dashboard/Cuentas/Tarjetas/Movimientos/Settings | El item activo del sidebar marca la ruta actual | ✅ | OK. |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHELL-N2-01 | Colapso de sidebar persiste | desktop | Click en el **botoncito circular con flecha `‹`** que flota sobre el borde derecho del sidebar (arriba) → el sidebar se achica a solo iconos → recargar la página | El colapso se mantiene tras recarga (cookie); con `›` vuelve a expandirse | ⬜ | Pasos aclarados: "colapsar" = achicar el sidebar a modo solo-iconos con el toggle del borde. |
| SHELL-N2-02 | Hamburger mobile-web | `390x844` | Abrir hamburger → Escape | Drawer full-screen; Escape lo cierra; sin sidebar desktop | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHELL-N3-01 | Loading y error no rompen chrome | red lenta / error simulado | Entrar a dashboard y Cuentas | Hay feedback de loading; el error ofrece retry/mensaje útil; la app no queda en blanco; el chrome principal permanece | ⬜ | |

---

## Módulo 7 — Movimientos

Ingresos/gastos cash y bank, transferencia, ajuste, cambio de moneda, filtros, detalle, saldo negativo.

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| MOV-N1-01 | Ingreso ARS | Sueldo `800.000` en Galicia (categoría **Sueldo**) | Nuevo movimiento → ingreso → guardar | Aparece en la lista; saldo ARS de la cuenta sube; importe con miles y color de ingreso | ⬜ | Si ya se cargó durante la corrida del dashboard, validar sobre el existente. |
| MOV-N1-02 | Gasto ARS | Súper `45.500,75` en Billetera (**Comida/Supermercado**) | Nuevo gasto → guardar (probar el decimal con la tecla `.` del numpad) | Saldo baja; color de gasto; decimal con coma o tecla `.` (fix `0de436d`) | ⬜ | Ídem nota anterior. |
| MOV-N1-03 | Movimiento en USD | Ahorro USD `300` en Galicia (**Inversiones**) | Nuevo ingreso USD | Impacta el ledger USD; no toca ARS | ⬜ | Ídem. |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| MOV-N2-01 | Editar movimiento | Supermercado (`45.500,75`) | Abrir detalle → editar: monto a `46.000` y subcategoría a Restaurante → guardar | Cambios persisten; el saldo de Billetera recalcula (−499,25 adicionales) | ⬜ | |
| MOV-N2-02 | Borrar movimiento | el gasto "Cine" `1.000` del dataset de spending | Detalle → borrar | Desaparece; saldo de Billetera se revierte (+`1.000`); el % de spending recalcula | ⬜ | Borrar Cine y no Supermercado, para no romper el dataset de los demás casos. |
| MOV-N2-03 | Filtros y búsqueda | dataset cargado | (1) Buscar texto `Súper`; (2) filtrar tipo = Gasto; (3) categoría = Comida; (4) rango = mes actual | Cada filtro reduce la lista correctamente; la búsqueda matchea descripción; combinados se acumulan | ⬜ | |
| MOV-N2-04 | Transferencia entre cuentas | Galicia → Billetera ARS `50.000` | Nuevo → transferencia | Sale de origen, entra a destino; no cuenta como gasto/ingreso neto (el balance del mes no la suma) | ⬜ | |
| MOV-N2-05 | Detalle de movimiento | uno por tipo: Sueldo (ingreso), Supermercado (gasto), la transferencia | Abrir detalle de cada uno | Muestra campos correctos según tipo (cuenta, categoría, fecha contable AR); acciones editar/eliminar como iconos | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| MOV-N3-01 | Aviso de saldo negativo (no bloqueante) | gasto ARS por **más que el saldo actual de Billetera** (mirar el saldo y sumarle `10.000`) | Cargar el gasto → observar → guardar igual → borrarlo después | Aparece **aviso** no bloqueante antes de guardar; permite guardar; el saldo queda negativo y se muestra | ⬜ | Borrar el gasto al terminar para no contaminar los demás casos. |
| MOV-N3-02 | Ajuste de saldo | Billetera ARS | Nuevo → ajuste → fijar el saldo (ej. redondearlo al millar más cercano) | Ajusta el saldo sin ser ingreso/gasto común; en la lista se distingue como ajuste | ⬜ | |
| MOV-N3-03 | Cambio de moneda (exchange) | vender `100` USD de Galicia a cotización `1.250` | Nuevo → cambio de moneda → cotización `1.250` | Crea las dos piernas: −`u$s 100` y +`$ 125.000` en Galicia; respeta cotización; no mezcla ledgers | ⬜ | |
| MOV-N3-04 | Orden de display estable | 3 gastos hoy mismo: `1.000`, `2.000`, `3.000` (descr. A, B, C) | Cargarlos seguidos → mirar la lista → recargar | Orden consistente y estable entre recargas (no se reordenan al azar) | ⬜ | Borrarlos al terminar. |

---

## Módulo 8 — Tarjetas de crédito

Períodos, consumos, cuotas, USD con cotización, pago de resumen.

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| CARD-N1-01 | Alta de tarjeta | `Visa Galicia`, Visa, límite `500.000` | Tarjetas → crear → guardar | Aparece en Tarjetas (no en Cuentas); saldo inicial 0; período actual creado | ✅ | OK. |
| CARD-N1-02 | Consumo simple | gasto ARS en la tarjeta | Nuevo gasto con tarjeta | Se asigna al período correcto; suma a la deuda del período | ✅ | OK. |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| CARD-N2-01 | Consumo en cuotas | gasto ARS en N cuotas | Cargar con cuotas | Genera fila padre off-ledger + cuotas; las cuotas caen en períodos sucesivos; "Cuotas en curso" muestra nombre y **fecha de compra** correctos; la lista de movimientos marca la compra con chip "N cuotas" | ✅ | Funcional OK tras fixes: header `168a679`/`57284f4`; fecha de compra `57284f4` (embed self-referencial → stitch); chip "N cuotas" en listas `1a3d0c2` (antes no había referencia a cuotas en el listado). |
| CARD-N2-02 | Consumo en USD sin cotización | gasto USD `50` en Visa Galicia | Cargar gasto USD en tarjeta | El alta **NO pide cotización** (la conversión real es al pagar el resumen); el consumo suma a la deuda USD del período, separada de la ARS; **no** aparece marca de "revisar cotización" en la lista | ✅ | OK con el flujo nuevo (requirió la migración `0027` que relajó I-CRED-11 a nivel DB). |
| CARD-N2-03 | Pago de resumen (centavos) | `Master QA Pagos`, deuda ARS `10.000,50` | Pagar el período desde `Galicia sueldo` | Crea el gasto de pago; el período queda pago; **el centavo no se pierde**; el form de fechas del próximo período muestra el último cierre conocido y valida contra él | ✅ | Verificado en la corrida del change FX (el detalle del pago muestra $ 10.000,50 exactos). Fix asociado: error crudo `chk_period_dates` → mensaje localizado + contexto de fechas en el form. |
| CARD-N2-04 | Pago de resumen con deuda USD | `Master QA Pagos` + consumo USD `50` retro-fechado al 28/05 | Pagar el período | El form pide la **cotización del día**; desglose pendiente ARS + USD×cotización = total; monto autocompletado (editable); la cotización persiste en el gasto de pago; el detalle del pago muestra la **composición** (pesos/dólares del resumen) y los resúmenes pagados muestran el USD pagado | ✅ | Verificado en la corrida del change FX. Fixes asociados en la misma corrida: reasignación de período al editar fecha, `paidAmountUSD`, composición en el detalle del pago, USD más visible en el hero de tarjetas. |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| CARD-N3-01 | Período estimado vs cerrado | `Master QA Pagos` tras pagar CARD-N2-03 | "Ver todos los resúmenes" → recorrer períodos | Distingue período pagado / cerrado / en curso / estimado; fechas contables AR | ⬜ | Se ejecuta después de CARD-N2-03 (el pago crea el período siguiente y deja historial para comparar estados). |
| CARD-N3-02 | Borrar consumo con cuotas | una de las compras en cuotas ya cargadas en Visa Galicia | Detalle del movimiento (compra padre) → eliminar | Maneja consistencia (padre + cuotas) sin dejar huérfanos; la deuda de los períodos se recalcula | ⬜ | Usar la compra de 6 cuotas (la de 3 conservarla para regresiones de "Cuotas en curso"). |

---

## Módulo 9 — Recurrencias

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REC-N1-01 | Crear recurrencia directa | regla "Gimnasio" (ver dataset: `15.000` mensual, Billetera, Salud, start hoy) | Crear regla desde cero | **Primera instancia pendiente HOY** (en `start_date`, no en start+intervalo) | ⬜ | |
| REC-N1-02 | Confirmar instancia pendiente | la instancia de hoy de "Gimnasio" | Bloque de pendientes → confirmar | Genera el movimiento real (`15.000` en Billetera, marcado recurrente); sale de pendientes | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REC-N2-01 | Editar monto al confirmar | la próxima instancia de "Gimnasio" (o crear regla "Verdulería" del dataset y usar la de hoy) | Editar monto a `16.000` → confirmar | Usa el override (`16.000`); la regla sigue en `15.000` para las siguientes | ⬜ | |
| REC-N2-02 | Recurrencia USD en tarjeta confirma sin cotización | regla de gasto USD mensual sobre Visa Galicia, start hoy → instancia pendiente | Confirmar la instancia | El confirm **no pide cotización**; genera el consumo USD en el período correspondiente; la conversión queda para el pago del resumen | ⬜ | Reescrito por el change `card-fx-at-statement-payment` (antes pedía fx al confirmar). |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REC-N3-01 | Frecuencia custom | regla "Verdulería" (ver dataset: cada `10` días, `5.000`, start hoy) | Crear con frecuencia custom → mirar próximas fechas | Instancia hoy y la siguiente a +10 días (no mensual) | ⬜ | |
| REC-N3-02 | Pausar / reactivar | regla "Gimnasio" | Pausar → verificar que no genera → reactivar | Deja de generar al pausar; retoma al reactivar sin duplicar instancias | ⬜ | |

---

## Módulo 10 — Reintegros

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REI-N1-01 | Reintegro simple | gasto "Farmacia" (ver dataset: `20.000`, Salud/Farmacia, reintegro esperado `10.000`) | Cargar gasto marcando reintegro | Queda como pendiente de reintegro con monto estimado `10.000` | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REI-N2-01 | Conciliar reintegro | el pendiente de "Farmacia" | Bloque pendientes → conciliar con monto real `9.500` | Ajusta el neto (gasto efectivo `10.500`); sale de pendientes | ⬜ | |
| REI-N2-02 | Cap de reintegro | nuevo gasto `30.000` con reintegro esperado/tope `12.000` | Cargar con cap → intentar conciliar por `15.000` | Respeta el tope `12.000`; no permite exceder | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REI-N3-01 | Reintegro mayor al gasto | nuevo gasto `20.000` con reintegro esperado `20.000`; conciliar con real `25.000` | Conciliar | Maneja el caso sin saldo inconsistente (rechaza el exceso o lo registra como neto positivo, pero **consistente** y localizado) | ⬜ | |

---

## Módulo 11 — Dashboard con datos / Spending by category

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SPEND-N1-01 | Gasto por categoría | **dataset de spending** (4 gastos redondos, ver "Datos") | Abrir spending-by-category | Agrupa por categoría; con solo ese set: Comida `15.000` (75%) · Transporte `4.000` (20%) · Entretenimiento `1.000` (5%) | ⬜ | Si hay otros gastos del mes en esas categorías, validar montos (no %). |
| SPEND-N1-02 | Balance mensual | ingresos y gastos del mes cargados | Ver balance del mes | Ingreso − gasto **por moneda**, sin convertir; coincide con los totales del gráfico del dashboard | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SPEND-N2-01 | Desglose por subcategoría | dataset de spending | Expandir Comida | Breakdown: Supermercado `10.000` / Restaurante `5.000` | ⬜ | |
| SPEND-N2-02 | Filtro por subcategoría | dataset de spending | Filtrar por Comida/Supermercado | La lista muestra solo Súper redondo (+ Supermercado del dataset base si está) y el total responde | ⬜ | |

---

## Módulo 12 — Compartido

Hogar de 2 miembros, gasto compartido = transacción real + split, deuda derivada por moneda,
liquidación (handshake liviano), primer caso de RLS cross-user.

> **Requiere QA-B registrado** (corrida de usuario nuevo: Auth + Onboarding de QA-B primero).
> Dataset en "Datos → Dataset para Compartido".

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHA-N1-01 | Crear hogar e invitar | QA-A + QA-B | Crear hogar → invitar → QA-B acepta | Hogar con 2 miembros; split por defecto | ⬜ | |
| SHA-N1-02 | Gasto compartido | "Cena" `10.000` ARS, Billetera de QA-A, split 50/50 | QA-A carga gasto compartido | Crea transacción real + split por miembro; deuda QA-B→QA-A `5.000` ARS | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHA-N2-01 | Deuda por moneda | + "Streaming anual" `100` USD split 50/50 | Ver deuda | Deuda separada: `5.000` ARS y `u$s 50`; nunca sumada/convertida | ⬜ | |
| SHA-N2-02 | Liquidación | la deuda ARS pendiente | QA-A liquida → QA-B asigna cuenta | Dos movimientos `settlement`; handshake liviano; la deuda ARS se salda (la USD sigue) | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHA-N3-01 | RLS cross-user (lectura) | QA-A y QA-B | QA-B mira transacciones compartidas de QA-A | Puede **leer** las compartidas; **no** puede escribirlas | ⬜ | |
| SHA-N3-02 | RLS aislamiento | QA-A y un tercero sin hogar | Tercero intenta ver datos del hogar | No accede a nada del hogar ajeno | ⬜ | |

---

## Módulo 13 — Responsive y paridad mobile (transversal)

`cross-platform` — la paridad mobile está diferida; registrar diferencias como observación, no defecto, salvo regresión.

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| RWD-01 | Web responsive 1440 vs 390 | — | Recorrer módulos en ambos viewports | Layout coherente; FAB solo en mobile-web; sin scroll horizontal | ⬜ | |
| RWD-02 | Montos no se cortan | montos largos (millones) | Ver hero, listas, detalle | Importes con miles caben; `tabular-nums` alineado | ⬜ | |

---

## Registro de cambios (fixes surgidos de QA)

| Fecha | Caso/Origen | Cambio | Commit |
|---|---|---|---|
| 2026-06-02 | Onboarding USD | Separador de miles al tipear en inputs de dinero | `70a4428` |
| 2026-06-02 | Settings centavos | ARS muestra 2 decimales con centavos ON | `4b26357` |
| 2026-06-02 | Detalle de cuenta | Botón "agregar movimiento" usa `Button` de la librería | `4b26357` |
| 2026-06-02 | Crear cuenta | Solo Bancaria/débito (sin Efectivo); nombre opcional | `4b26357` |
| 2026-06-02 | CTAs | 3 CTAs primarios migrados a `Button` | `608cb48` |
| 2026-06-02 | Input dinero | Agrupado robusto (sin decimal fantasma al tipear montos grandes) | `d74f2d8` |
| 2026-06-03 | ACC-N1-OBS | Iconos lápiz/papelera/archivo en fila y detalle; "Editar" de la fila abre el drawer compartido (ruta `/edit` = fallback no-JS); eliminar solo en detalle | `996bacf` |
| 2026-06-03 | ACC-N2-03 | El selector de institución abre el listado al click aunque haya una ya seleccionada (antes había que borrar el texto); lista todas para cambiar + resalta la actual | `078ba85` |
| 2026-06-03 | ACC-N3-03 | Empty-state de movimientos usa el `Button` de la librería (emerald + ícono) en vez de `bg-primary` crudo (negro) | `16a1364` |
| 2026-06-03 | DASH-N2-01 | El toggle del ojo (esconder importes) persiste per-device (cookie) en vez de resetearse al navegar; sin flash de importes reales | `d8f2644` |
| 2026-06-03 | Input dinero | La tecla `.` (incl. numpad) ahora produce el separador decimal en campos agrupados; antes se descartaba y convertía `45500.75` en `4550075` | `0de436d` |
| 2026-06-03 | Detalle de movimiento | Editar/Eliminar pasan de estar tras el kebab `⋯` a iconos directos (lápiz/papelera), consistente con cuentas; borrar sigue con diálogo de confirmación | `1140f31` |
| 2026-06-03 | DASH-N2-04 | Dashboard bimoneda: "Balance del mes" pasa a gráfico de doble eje (ARS izq / USD der) + totales USD; "En qué se fue" muestra lista USD subordinada. Antes el USD se filtraba/descartaba | `a00b32f` |
| 2026-06-03 | DASH-N3-01 | El label del navegador de mes no parte el año a otra línea en mobile (`whitespace-nowrap`) | `74c9a4b` |
| 2026-06-03 | SET-N2-01 | Traducción de categorías de sistema implementada (change `translate-system-categories-display`, archivado): canonical_name+user_id por contratos de datos + label i18n en todos los displays | `dcbfd28` |
| 2026-06-03 | CARD-N2-01 (obs.) | Detalle de tarjeta: botón "Registrar consumo" + ícono lápiz en el header (antes no había forma de agregar consumo con historial y "Editar" era texto al pie) | `168a679` |
| 2026-06-03 | CARD-N2-01 | "Cuotas en curso": fecha de compra y nombre correctos (el embed self-referencial del parent fallaba → mostraba la fecha de la última cuota y el nombre fallback); lápiz apilado abajo del botón | `57284f4` |
| 2026-06-03 | CARD-N2-01 (obs.) | Las compras en cuotas muestran chip "N cuotas" en las listas de movimientos (antes ninguna referencia fuera de la vista de período) | `1a3d0c2` |
| 2026-06-03 | CARD-N2-02 / REC-N2-02 | Implementado `card-fx-at-statement-payment`: el alta de consumo USD y el confirm de recurrencias ya no piden cotización (flag de revisión eliminado); el pago de resumen con deuda USD pide la cotización del día, computa el total con desglose y la persiste en el gasto de pago. Casos reescritos + CARD-N2-04 nuevo | (branch `feat/card-fx-at-payment`) |
| 2026-06-03 | Cierre tanda 2 | Refuerzo del doc: dataset de spending con números redondos, 2ª tarjeta con período cerrado para CARD-N2-03 (antes era imposible de probar), categorías corregidas al seed real (Comida, no "Alimentos"), datos concretos en MOV/REC/REI/SHA, corrida de usuario nuevo agrupada | (doc) |
| 2026-06-04 | CARD-N2-02 (DB) | Migración `0027`: el trigger I-CRED-11 exigía cotización en consumos USD a nivel DB (bloqueaba el flujo nuevo) y habría rechazado persistir la cotización en el gasto de pago. Relajado al modelo nuevo; aplicada al remoto | `9bec9e5` |
| 2026-06-04 | Editar consumo de tarjeta | Cambiar la fecha de un consumo ahora **reasigna el resumen** (`card_period_id` + `due_date`) al período que cubre la nueva fecha; mover a un resumen ya pagado se bloquea. Antes la fecha cambiaba pero el consumo no se movía de resumen | (branch fx) |
| 2026-06-04 | Pago de resumen (UX) | Form de pago: contexto del último cierre conocido + validación de fechas con mensaje claro; el error crudo de Postgres `chk_period_dates` se reemplaza por copy localizada | (branch fx) |
| 2026-06-04 | Resúmenes pagados | `paidAmountUSD` nuevo: la lista de resúmenes y el detalle del período muestran el USD pagado (antes `u$s 0`); el detalle del movimiento de pago muestra la **composición** pesos/dólares en vez de repetir período/vencimiento | (branch fx) |
| 2026-06-04 | Hero de tarjetas | USD de "A pagar este mes" sube a 24px (era nota al pie); filas de "Próximos vencimientos" muestran su USD pendiente | (branch fx) |
| 2026-06-04 | Editar movimiento | "Guardar cambios" usa el `Button` de la librería (era botón crudo navy) | (branch fx) |

---

## Próximos pasos / huecos conocidos

**Pendiente de ejecutar (con datasets ya preparados en este doc):**

- **Corrida de usuario nuevo (QA-B):** Módulo 1 (Auth) + Módulo 2 (Onboarding) + DASH-N3-02 +
  Módulo 12 (Compartido). Todo en una sesión: registrar QA-B → onboarding → hogar con QA-A.
- **Módulo 6 N2/N3:** colapso de sidebar (pasos ya aclarados), hamburger mobile, loading/error.
- **Módulo 7 (Movimientos):** completo — N1 puede validarse sobre lo ya cargado.
- **Módulo 8:** CARD-N2-03 + N3 con la 2ª tarjeta `Master QA Pagos` (dataset nuevo).
- **Módulo 9 (Recurrencias):** completo — REC-N2-02 ya reescrito al flujo nuevo (confirm USD en tarjeta sin cotización), pendiente de ejecutar.
- **Follow-up de UX (sin caso):** evaluar filas clickeables + mini-CTA "Pagar →" en "Próximos vencimientos" del hero de tarjetas (el hero agrega varias tarjetas, por eso no lleva botón único de pagar).
- **Módulos 10, 11, 13:** datasets concretos agregados en esta versión.
- **DASH-N2-02:** re-correr con 1 movimiento por moneda (caso reescrito).

**Changes dedicados surgidos de esta tanda (propuestos, sin implementar):**

- `translate-system-categories-display` (branch `feat/i18n-system-categories`): traducir
  categorías/subcategorías de sistema en todos los displays — conformance del spec `categories`.
- `card-fx-at-statement-payment` (branch `feat/card-fx-at-payment`): la cotización USD se
  captura al pagar el resumen, no al cargar el consumo. Desbloquea CARD-N2-02 y REC-N2-02.

**Huecos estructurales:**

- Paridad mobile (cards, drawer de movimientos, accounts) está diferida.
- Casos de concurrencia/optimistic UI no cubiertos en profundidad.
