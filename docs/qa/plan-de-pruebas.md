# Plan de pruebas funcional — Grana v3

Documento vivo. Reemplaza el enfoque por "instancias" de `instancia-01-base-funcional.md`
(que queda como borrador de origen). Acá los casos se organizan **por módulo** y dentro
de cada módulo por **nivel**, del happy path a los casos inusuales / borde.

- **Versión del doc:** 2026-06-02
- **Referencia contable de la suite:** `2026-06-01`, zona `America/Argentina/Buenos_Aires`
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
- **Dinero (input):** los miles se agrupan con punto al tipear (`1.000`), el **decimal se carga
  con coma** (`1.000,50`). Un punto se interpreta como separador de miles, no como decimal.
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
| Cierre / Vencimiento | según wizard (período actual) |

### Dataset para movimientos (módulo Movimientos)

| Concepto | Tipo | Cuenta | Moneda | Monto | Categoría |
|---|---|---|---|---:|---|
| Sueldo | Ingreso | Galicia sueldo | ARS | `800.000` | Ingresos/Sueldo |
| Supermercado | Gasto | Billetera | ARS | `45.500,75` | Alimentos |
| Ahorro USD | Ingreso | Galicia sueldo | USD | `300` | Ingresos |
| Transferencia | Transferencia | Galicia → Billetera | ARS | `50.000` | — |

---

## Módulo 1 — Autenticación

OTP de 8 dígitos, sin magic link. Mensajes localizados; sin filtrado de información.

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
| ONB-N2-02 | Decimal con coma | ARS | Tipear `125000,50` | Muestra `125.000,50`; un punto tipeado se trata como miles | ⬜ | |
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
| ACC-N1-01 | Alta de cuenta bancaria bimoneda | `Galicia sueldo`, Galicia, ARS `450.000`, USD `1.000` | Cuentas → crear → completar → guardar | Aparece en **Bancarias**; avatar con branding Galicia; ARS y USD por separado | ⬜ | |
| ACC-N1-02 | Lista agrupada, sin tarjetas | — | Abrir `/accounts` | Sección **Efectivo** (Billetera) y **Bancarias** (Galicia); filas con avatar/nombre/saldos/acción; tarjetas de crédito **no** están acá | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ACC-N2-01 | Crear **solo** permite Bancaria/débito | — | Abrir "crear cuenta" | **No** existe opción Efectivo; el form es bancario; el nombre es **opcional** (hereda del banco) | ⬜ | |
| ACC-N2-02 | Institución custom desde el form | `Cooperativa Barrio Norte`, `#3A7D44`, `wallet` | En alta, crear institución desde el selector → crear `Cooperativa ahorro` | La institución queda disponible solo para QA-A; la cuenta usa el branding custom (color + icono) | ⬜ | |
| ACC-N2-03 | Editar institución → avatar heredado en vivo | `Galicia sueldo` sin override | Editar → cambiar institución a Cooperativa Barrio Norte → guardar | Conserva nombre; el avatar pasa al branding nuevo por herencia, sin override manual | ⬜ | |
| ACC-N2-04 | Borrar cuenta bancaria sin historial | `Cuenta descartable` (bank, sin movimientos) | Crear → detalle → eliminar | La UI ofrece **Eliminar** (no Archivar); borrado permanente; desaparece de la lista | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| ACC-N3-01 | No desactivar moneda con saldo ≠ 0 | Billetera USD `250` | Editar Billetera → intentar desactivar USD | Rechazado; USD sigue activa; mensaje **localizado** que orienta | ⬜ | |
| ACC-N3-02 | Archivar cuenta **con** movimientos | Galicia (con movimientos) | Detalle → acción | La UI ofrece **Archivar** (no Eliminar); al archivar puede reactivarse | ⬜ | |
| ACC-N3-03 | Botón "agregar movimiento" es de la librería | dentro de una cuenta | Abrir detalle de cuenta | El botón usa el componente `Button` (primario emerald + ícono), consistente con el dashboard | ⬜ | |
| ACC-N3-04 | Nombre demasiado largo | >50 chars | Intentar guardar | Validación localizada; no persiste | ⬜ | |

---

## Módulo 4 — Dashboard

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| DASH-N1-01 | Hero bimoneda contra dataset | dataset base sin movimientos | Abrir dashboard | ARS `$ 575.000,50` y USD `u$s 1.250,00`; ARS primario, USD subordinado; sin conversión ni total unificado | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| DASH-N2-01 | Toggle del ojo | — | Activar ojo → recorrer → salir a Cuentas y volver | Enmascara importes sin ocultar labels; al volver se ven; **no persiste** fuera del dashboard | ⬜ | |
| DASH-N2-02 | Hero con datos | tras cargar movimientos | Volver al dashboard | Totales reflejan movimientos por moneda; sigue sin sumar monedas | ⬜ | |
| DASH-N2-03 | Navegador de mes | meses con/sin datos | Usar prev/next | Cambia el período; deshabilita extremos sin datos | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| DASH-N3-01 | Desktop vs mobile-web | `1440x900` y `390x844` | Abrir en ambos | Desktop: hero arriba + dos columnas, **sin FAB**, "Nuevo movimiento" en header. Mobile-web: secciones apiladas, **FAB** y sin botón en header | ⬜ | cross-platform parcial |
| DASH-N3-02 | Tarjeta de bienvenida (sin movimientos) | usuario nuevo | Dashboard recién onboarded | CTA "primer movimiento" usa el componente `Button` | ⬜ | |

---

## Módulo 5 — Settings e i18n

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SET-N1-01 | Toggle de centavos | — | Settings → desactivar centavos → dashboard → reactivar y recargar | Oculta/muestra centavos según preferencia; **persiste** tras recargar; el ledger no cambia | ⬜ | |
| SET-N1-02 | Centavos ON muestra 2 decimales | ARS con decimales | Activar centavos | ARS muestra **2 decimales** siempre (ej. `$ 125.000,50`), no uno solo (regresión del fix) | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SET-N2-01 | Cambio de idioma a inglés | — | Cambiar a English → recorrer dashboard/Cuentas/Settings → recargar | Labels de producto en inglés; **nombres cargados por el usuario** (ej. `Galicia sueldo`) no se traducen; persiste (web: cookie) | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SET-N3-01 | Idioma no sincroniza entre plataformas | web + mobile | Cambiar en web | Web usa cookie, mobile SecureStore; cambiar una **no** afecta la otra | ⬜ | cross-platform |

---

## Módulo 6 — Navegación / Shell

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHELL-N1-01 | Navegación desktop | `1440x900` | Recorrer Dashboard/Cuentas/Tarjetas/Movimientos/Settings | El item activo del sidebar marca la ruta actual | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHELL-N2-01 | Colapso de sidebar persiste | desktop | Colapsar sidebar → recargar | El colapso se mantiene tras recarga | ⬜ | |
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
| MOV-N1-01 | Ingreso ARS | Sueldo `800.000` en Galicia | Nuevo movimiento → ingreso → guardar | Aparece en la lista; saldo ARS de la cuenta sube; importe con miles y color de ingreso | ⬜ | |
| MOV-N1-02 | Gasto ARS | Súper `45.500,75` en Billetera | Nuevo gasto → guardar | Saldo baja; importe con color de gasto; decimal con coma | ⬜ | |
| MOV-N1-03 | Movimiento en USD | Ahorro USD `300` en Galicia | Nuevo ingreso USD | Impacta el ledger USD; no toca ARS | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| MOV-N2-01 | Editar movimiento | Súper | Abrir detalle → editar monto/categoría → guardar | Cambios persisten; saldos recalculan | ⬜ | |
| MOV-N2-02 | Borrar movimiento | Súper | Detalle → borrar | Desaparece; saldo se revierte | ⬜ | |
| MOV-N2-03 | Filtros y búsqueda | varios movimientos | Filtrar por tipo/categoría/fecha; buscar texto | Lista filtra correctamente; búsqueda matchea descripción | ⬜ | |
| MOV-N2-04 | Transferencia entre cuentas | Galicia → Billetera ARS `50.000` | Nuevo → transferencia | Sale de origen, entra a destino; no cuenta como gasto/ingreso neto | ⬜ | |
| MOV-N2-05 | Detalle de movimiento | cualquiera | Abrir detalle | Muestra campos correctos según tipo (cuenta, categoría, fecha contable AR) | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| MOV-N3-01 | Aviso de saldo negativo (no bloqueante) | gasto > saldo | Cargar gasto que deja negativo | Aparece **aviso** no bloqueante; permite guardar igual | ⬜ | |
| MOV-N3-02 | Ajuste de saldo | reconciliación | Crear ajuste | Ajusta el saldo sin ser ingreso/gasto común | ⬜ | |
| MOV-N3-03 | Cambio de moneda (exchange) | ARS↔USD con cotización | Nuevo → exchange → cotización | Crea las dos piernas; respeta cotización; no mezcla ledgers | ⬜ | |
| MOV-N3-04 | Orden de display estable | misma fecha | Cargar varios el mismo día | Orden consistente y legible | ⬜ | |

---

## Módulo 8 — Tarjetas de crédito

Períodos, consumos, cuotas, USD con cotización, pago de resumen.

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| CARD-N1-01 | Alta de tarjeta | `Visa Galicia`, Visa, límite `500.000` | Tarjetas → crear → guardar | Aparece en Tarjetas (no en Cuentas); saldo inicial 0; período actual creado | ⬜ | |
| CARD-N1-02 | Consumo simple | gasto ARS en la tarjeta | Nuevo gasto con tarjeta | Se asigna al período correcto; suma a la deuda del período | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| CARD-N2-01 | Consumo en cuotas | gasto ARS en N cuotas | Cargar con cuotas | Genera fila padre off-ledger + cuotas; las cuotas caen en períodos sucesivos | ⬜ | |
| CARD-N2-02 | Consumo en USD con cotización | gasto USD + `fx_rate` | Cargar gasto USD en tarjeta | Pide cotización; el campo de cotización **no** agrupa miles ni fuerza 2 decimales (admite 6) | ⬜ | |
| CARD-N2-03 | Pago de resumen | período con deuda | Pagar período desde otra cuenta | Crea el pago; el centavo no se pierde (input es text/decimal, no number) | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| CARD-N3-01 | Período estimado vs cerrado | fechas de cierre | Recorrer períodos | Distingue estimado de cerrado; fechas contables AR | ⬜ | |
| CARD-N3-02 | Borrar consumo con cuotas | consumo en cuotas | Intentar borrar | Maneja consistencia (padre + cuotas) sin dejar huérfanos | ⬜ | |

---

## Módulo 9 — Recurrencias

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REC-N1-01 | Crear recurrencia directa | gasto mensual, `start_date` hoy | Crear regla desde cero | **Primera instancia en `start_date`** (no en start+intervalo) | ⬜ | |
| REC-N1-02 | Confirmar instancia pendiente | recurrencia activa | Bloque de pendientes → confirmar | Genera el movimiento real; sale de pendientes | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REC-N2-01 | Editar monto al confirmar | instancia pendiente | Editar monto → confirmar | Usa el override; no rompe la regla | ⬜ | |
| REC-N2-02 | Recurrencia USD en tarjeta con fx | pendiente USD card | Cargar cotización → confirmar | El campo fx admite coma/decimales; no agrupa miles | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REC-N3-01 | Frecuencia custom | cada N días/meses | Crear con frecuencia custom | Genera instancias en el intervalo correcto | ⬜ | |
| REC-N3-02 | Pausar / reactivar | regla activa | Cambiar estado | Deja de generar al pausar; retoma al reactivar | ⬜ | |

---

## Módulo 10 — Reintegros

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REI-N1-01 | Reintegro simple | gasto con reintegro esperado | Cargar gasto marcando reintegro | Queda como pendiente de reintegro con monto estimado | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REI-N2-01 | Conciliar reintegro | pendiente | Bloque pendientes → conciliar con monto real | Ajusta el neto; sale de pendientes | ⬜ | |
| REI-N2-02 | Cap de reintegro | reintegro con tope | Cargar con cap | Respeta el tope; no excede | ⬜ | |

### N3 · Avanzado / inusual

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| REI-N3-01 | Reintegro mayor al gasto | monto real > gasto | Conciliar | Maneja el caso sin saldo inconsistente | ⬜ | |

---

## Módulo 11 — Dashboard con datos / Spending by category

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SPEND-N1-01 | Gasto por categoría | varios gastos | Abrir spending-by-category | Agrupa por categoría; montos coinciden con el dataset | ⬜ | |
| SPEND-N1-02 | Balance mensual | ingresos y gastos del mes | Ver balance del mes | Ingreso − gasto por moneda, sin convertir | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SPEND-N2-01 | Desglose por subcategoría | gastos con subcategoría | Expandir categoría | Muestra breakdown por subcategoría | ⬜ | |
| SPEND-N2-02 | Filtro por subcategoría | — | Filtrar | La lista y el total responden al filtro | ⬜ | |

---

## Módulo 12 — Compartido

Hogar de 2 miembros, gasto compartido = transacción real + split, deuda derivada por moneda,
liquidación (handshake liviano), primer caso de RLS cross-user.

### N1 · Básico

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHA-N1-01 | Crear hogar e invitar | QA-A + QA-B | Crear hogar → invitar → QA-B acepta | Hogar con 2 miembros; split por defecto | ⬜ | |
| SHA-N1-02 | Gasto compartido | gasto ARS dividido | QA-A carga gasto compartido | Crea transacción real + split por miembro; deuda derivada por moneda | ⬜ | |

### N2 · Intermedio

| ID | Caso | Datos | Pasos | Esperado | Estado | Notas |
|---|---|---|---|---|---|---|
| SHA-N2-01 | Deuda por moneda | gastos ARS y USD | Ver deuda | Deuda separada por moneda; nunca sumada/convertida | ⬜ | |
| SHA-N2-02 | Liquidación | deuda pendiente | QA-A liquida → QA-B asigna cuenta | Dos movimientos `settlement`; handshake liviano; deuda se salda | ⬜ | |

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

---

## Próximos pasos / huecos conocidos

- Paridad mobile (cards, drawer de movimientos, accounts) está diferida.
- Casos de concurrencia/optimistic UI no cubiertos en profundidad.
- Falta dataset reproducible para spending-by-category con números "redondos" verificables.
