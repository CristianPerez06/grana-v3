# Grana V3 - Guia QA funcional

## Instancia 01: base funcional

Version: `2026-06-01`  
Referencia contable: `2026-06-01`, zona `America/Argentina/Buenos_Aires`  
Alcance: web completo; mobile para escenarios marcados como cross-platform  
Fuentes: specs maestras de `auth`, `profiles`, `onboarding`, `accounts`, `dashboard`, `settings`,
`i18n`, `web-app-shell`, `mobile-app-shell`, `page-header`, `route-loading-and-errors`.

## Objetivo

Validar el recorrido mas comun de una persona que llega por primera vez a Grana: crear la cuenta,
confirmar el email por OTP, completar onboarding, verificar la provision bimoneda, sumar una cuenta
bancaria y recorrer las superficies base. Esta instancia deja preparado el dataset para cargar
movimientos en la Instancia 02.

## Estrategia por instancias

| Instancia | Modulos principales | Nivel | Resultado acumulado |
|---|---|---|---|
| 01 | Auth, onboarding, accounts, shell, settings | Comun | Usuario base con Billetera y Galicia |
| 02 | Transactions cash/bank, ajustes, transferencias, exchange | Comun a intermedio | Ledger bimoneda verificable |
| 03 | Cards, periodos, consumos, cuotas, pagos | Intermedio | Tarjeta con ciclo y deuda controlada |
| 04 | Recurrences y reimbursements | Intermedio a avanzado | Pendientes y reconciliaciones |
| 05 | Dashboard y spending-by-category | Integracion | Lecturas agregadas contra dataset conocido |
| 06 | Shared | Avanzado | Hogar de dos miembros y deuda derivada |
| 07 | RLS, responsive, mobile parity, edges contables | Edge cases | Regresion integral |

## Nota de alcance vigente

La change activa `redesign-movement-form-as-drawer` modifica la carga de movimientos. En web ya
existe el drawer y sus slices principales. La extraccion de logica compartida y el drawer mobile
siguen pendientes. Esta guia no trata esa diferencia como defecto en la Instancia 01; se probara
en la Instancia 02 con expectativa diferenciada por plataforma.

## Preparacion

### Ambientes y dispositivos

| Superficie | Configuracion minima |
|---|---|
| Web desktop | Chrome actual, viewport `1440x900` |
| Web mobile | Chrome responsive, viewport `390x844` |
| Mobile | Expo dev client en Android o iOS, cuando el caso indique cross-platform |
| Inbox | Casilla real capaz de recibir aliases `+<RUN>` |

### Identidades

Reemplazar `<RUN>` por un identificador de ejecucion, por ejemplo `20260601a`.

| Alias | Email sugerido | Password | Uso |
|---|---|---|---|
| QA-A | `qa.grana+<RUN>.a@<DOMINIO_REAL>` | `GranaQA2026!` | Usuario principal confirmado |
| QA-U | `qa.grana+<RUN>.u@<DOMINIO_REAL>` | `GranaQA2026!` | Usuario sin confirmar |
| QA-R | `qa.grana+<RUN>.r@<DOMINIO_REAL>` | `GranaQA2026!` | Recuperacion de password |
| QA-B | `qa.grana+<RUN>.b@<DOMINIO_REAL>` | `GranaQA2026!` | Reservado para Compartido |

### Datos que debe cargar QA

| Entidad | Campo | Valor |
|---|---|---|
| Perfil QA-A | Nombre completo | `Ana Base` |
| Billetera provisionada | Saldo inicial ARS | `125000,50` |
| Billetera provisionada | Saldo inicial USD | `250,00` |
| Cuenta bancaria | Nombre | `Galicia sueldo` |
| Cuenta bancaria | Institucion | `Galicia` |
| Cuenta bancaria | Saldo inicial ARS | `450000,00` |
| Cuenta bancaria | Saldo inicial USD | `1000,00` |
| Cuenta descartable | Nombre | `Prueba eliminar` |
| Cuenta descartable | Tipo | `Efectivo` |
| Institucion custom | Nombre | `Cooperativa Barrio Norte` |
| Institucion custom | Color | `#3A7D44` |
| Institucion custom | Icono | `wallet` |
| Cuenta custom | Nombre | `Cooperativa ahorro` |
| Cuenta custom | Institucion | `Cooperativa Barrio Norte` |
| Cuenta custom | Saldo inicial ARS | `0,00` |
| Cuenta custom | Saldo inicial USD | `0,00` |

## Reglas transversales a observar

- ARS y USD se muestran como ledgers separados. Nunca deben sumarse ni convertirse automaticamente.
- Todo usuario nuevo recibe `Billetera` con ARS y USD habilitados.
- El saldo inicial se persiste como saldo inicial: onboarding no debe crear un movimiento falso.
- Las fechas financieras siguen `America/Argentina/Buenos_Aires`.
- Los errores visibles deben estar localizados. Nunca mostrar mensajes raw de Supabase o Postgres.
- Web y mobile comparten semantica, aunque el layout sea nativo en cada plataforma.

## Ejecucion A - Registro, OTP y login

### QA01-AUTH-001 - Signup valido con OTP

Prioridad: alta  
Plataforma: web y mobile  
Datos: QA-A, nombre `Ana Base`, password `GranaQA2026!`

Pasos:
1. Abrir signup sin sesion.
2. Completar nombre, email QA-A, password y confirmacion.
3. Enviar el formulario.
4. Revisar el inbox y obtener el codigo OTP.

Esperado:
- Se navega a la pantalla de verificacion de signup.
- El email queda precargado por estado in-app.
- El email recibido muestra un codigo OTP de exactamente 8 digitos.
- El email no contiene ningun link para confirmar.
- No existe sesion autenticada antes de validar el OTP.

### QA01-AUTH-002 - Formato OTP invalido

Prioridad: alta  
Plataforma: web y mobile  
Precondicion: permanecer en verify de QA-A

Pasos:
1. Ingresar `1234567`.
2. Enviar.
3. Ingresar `1234A678`.
4. Enviar.

Esperado:
- Ambos valores se rechazan por validacion local.
- El usuario permanece en la pantalla.
- No se crea sesion.

### QA01-AUTH-003 - OTP valido y mensaje one-shot

Prioridad: alta  
Plataforma: web y mobile

Pasos:
1. Ingresar el OTP valido recibido por QA-A.
2. Confirmar.
3. Observar login.
4. Navegar fuera de login y volver.

Esperado:
- La cuenta queda confirmada.
- La app hace sign out inmediatamente despues de verificar.
- Login muestra el mensaje de cuenta confirmada una sola vez.
- Al volver a login, el mensaje one-shot ya no aparece.

### QA01-AUTH-004 - Login valido deriva a onboarding

Prioridad: alta  
Plataforma: web y mobile

Pasos:
1. Iniciar sesion con QA-A.

Esperado:
- La sesion se crea correctamente.
- Como QA-A todavia no completo onboarding, no aterriza en dashboard.
- Se redirige al wizard de onboarding.

### QA01-AUTH-005 - Cuenta duplicada

Prioridad: media  
Plataforma: web y mobile

Pasos:
1. Cerrar sesion.
2. Intentar registrarse otra vez con el email QA-A y datos validos.

Esperado:
- El form informa que el usuario ya existe.
- No navega a verify.
- No envia un nuevo email.

### QA01-AUTH-006 - Cuenta no confirmada y resend desde login

Prioridad: alta  
Plataforma: web y mobile  
Datos: QA-U

Pasos:
1. Registrar QA-U con datos validos, pero no ingresar el OTP.
2. Volver a login.
3. Intentar iniciar sesion con QA-U.
4. Activar la accion inline para reenviar codigo.

Esperado:
- Login muestra un mensaje especifico de email no confirmado.
- Aparece la accion de reenvio.
- Al activarla se navega a verify con el email cargado.
- El cooldown comienza en 60 segundos y el boton queda deshabilitado.

### QA01-AUTH-007 - Cooldown visible de resend

Prioridad: media  
Plataforma: web y mobile  
Precondicion: verify abierto para QA-U

Pasos:
1. Observar el boton de reenviar apenas abre verify.
2. Esperar hasta que el contador llegue a cero.
3. Reenviar.

Esperado:
- Durante el cooldown el boton esta deshabilitado y muestra segundos restantes.
- Al llegar a cero se habilita.
- Tras reenvio exitoso vuelve a quedar deshabilitado por 60 segundos.

### QA01-AUTH-008 - Credenciales invalidas no filtran informacion

Prioridad: media  
Plataforma: web y mobile

Pasos:
1. Intentar login con QA-A y password `Incorrecta123`.
2. Intentar login con `nadie+<RUN>@<DOMINIO_REAL>` y password `Incorrecta123`.

Esperado:
- Ambos casos muestran el mismo mensaje generico localizado.
- No hay sesion.
- En web la URL no recibe `?error=...`.

## Ejecucion B - Recuperacion de password

### QA01-AUTH-009 - Recovery OTP sin magic link

Prioridad: alta  
Plataforma: web y mobile  
Datos: usar QA-R, previamente registrado y confirmado

Pasos:
1. Abrir forgot-password.
2. Solicitar recuperacion para QA-R.
3. Revisar el inbox.
4. Abrir verify de recovery e ingresar el OTP valido.
5. Cargar password nuevo `GranaQA2026.New!`.

Esperado:
- El email contiene OTP de 8 digitos y no contiene link.
- Verify exitoso navega a la pantalla de password nuevo.
- El password se actualiza.
- Login con el password anterior falla.
- Login con `GranaQA2026.New!` funciona.

### QA01-AUTH-010 - Reset-password directo sin sesion recovery

Prioridad: alta  
Plataforma: web

Pasos:
1. Sin sesion de recovery, abrir directamente `/reset-password`.

Esperado:
- Middleware impide usar el formulario de password nuevo.
- El usuario es redirigido al entry point correcto del recovery.

## Ejecucion C - Onboarding y provision bimoneda

### QA01-ONB-001 - Wizard no salteable

Prioridad: alta  
Plataforma: web y mobile  
Datos: QA-A autenticado sin onboarding completo

Pasos:
1. Abrir la pantalla welcome.
2. Intentar navegar manualmente a done sin completar saldo actual.

Esperado:
- El wizard no permite saltar el paso intermedio.
- El usuario vuelve al paso pendiente.

### QA01-ONB-002 - Carga de saldo actual

Prioridad: alta  
Plataforma: web y mobile

Pasos:
1. Desde welcome continuar a saldo actual.
2. Cargar ARS `125000,50`.
3. Cargar USD `250,00`.
4. Continuar hasta done.

Esperado:
- La pantalla permite cargar ambos ledgers.
- Done muestra resumen.
- Al finalizar se marca onboarding completo y se navega a dashboard.
- La carga impacta `initial_balance` de Billetera.
- No aparece un movimiento artificial por saldo inicial.

### QA01-ONB-003 - Billetera provisionada por signup

Prioridad: alta  
Plataforma: web y mobile

Pasos:
1. Desde dashboard abrir Cuentas.
2. Abrir Billetera.

Esperado:
- Existe exactamente una cuenta cash inicial llamada `Billetera`.
- ARS y USD estan habilitados.
- Los saldos derivados son `$ 125.000,50` y `u$s 250,00`.

## Ejecucion D - Cuentas base

### QA01-ACC-001 - Alta de cuenta bancaria bimoneda

Prioridad: alta  
Plataforma: web  
Datos: `Galicia sueldo`, Galicia, ARS `450000,00`, USD `1000,00`

Pasos:
1. Abrir Cuentas.
2. Crear una cuenta bancaria/debito.
3. Completar los datos indicados.
4. Guardar.

Esperado:
- La cuenta aparece en la seccion Bancarias.
- Muestra avatar heredado del branding de Galicia.
- Muestra ARS y USD por separado.
- No se combinan los saldos.

### QA01-ACC-002 - Lista agrupada y tarjetas ausentes

Prioridad: media  
Plataforma: web

Pasos:
1. Abrir `/accounts`.

Esperado:
- Existe seccion Efectivo con Billetera.
- Existe seccion Bancarias con Galicia sueldo.
- Cada fila muestra avatar, nombre, balances y accion inline alineados.
- Las tarjetas de credito no pertenecen a esta lista.

### QA01-ACC-003 - Alta y eliminacion de cuenta sin historial

Prioridad: media  
Plataforma: web  
Datos: `Prueba eliminar`, tipo Efectivo

Pasos:
1. Crear la cuenta descartable.
2. Abrir su detalle.
3. Eliminarla.

Esperado:
- La UI ofrece Eliminar, no Archivar, porque no tiene movimientos.
- La eliminacion es permanente.
- La cuenta deja de aparecer en la lista.

### QA01-ACC-004 - Institucion custom desde form

Prioridad: media  
Plataforma: web  
Datos: institucion y cuenta custom definidos en Preparacion

Pasos:
1. Iniciar alta de cuenta bancaria.
2. Crear `Cooperativa Barrio Norte` desde el selector de institucion.
3. Usar color `#3A7D44` e icono `wallet`.
4. Crear `Cooperativa ahorro` con esa institucion.

Esperado:
- La institucion custom queda disponible solo para QA-A.
- La cuenta usa el branding custom.
- El avatar muestra el color `#3A7D44` y el icono wallet.

### QA01-ACC-005 - Editar institucion actualiza avatar heredado

Prioridad: media  
Plataforma: web  
Precondicion: `Galicia sueldo` sin override explicito de avatar

Pasos:
1. Editar `Galicia sueldo`.
2. Cambiar la institucion a `Cooperativa Barrio Norte`.
3. Guardar.

Esperado:
- La cuenta conserva su nombre.
- El avatar pasa a reflejar el branding de Cooperativa Barrio Norte.
- El cambio ocurre por herencia viva, sin requerir override manual.

### QA01-ACC-006 - Moneda no se desactiva con saldo distinto de cero

Prioridad: alta  
Plataforma: web  
Precondicion: Billetera tiene USD `250,00`

Pasos:
1. Editar Billetera.
2. Intentar desactivar USD.

Esperado:
- La operacion se rechaza.
- USD permanece activa.
- El mensaje visible es localizado y orienta al usuario.

## Ejecucion E - Dashboard, settings y shell

### QA01-DASH-001 - Hero bimoneda contra dataset base

Prioridad: alta  
Plataforma: web y mobile  
Precondicion: Billetera y Galicia sueldo con valores de esta guia; si ACC-005 cambio Galicia,
la cuenta sigue sumando igual.

Pasos:
1. Abrir dashboard sin movimientos.

Esperado:
- Hero muestra ARS `$ 575.000,50`.
- Hero muestra USD `u$s 1.250,00`.
- ARS es visualmente primario y USD subordinado.
- No existe conversion ni total unificado.

### QA01-DASH-002 - Eye toggle

Prioridad: media  
Plataforma: web y mobile

Pasos:
1. Activar el boton ojo.
2. Recorrer importes visibles.
3. Salir a Cuentas y volver.

Esperado:
- Los importes del dashboard se enmascaran sin ocultar labels.
- Al volver al dashboard los importes vuelven a verse.
- El estado no persiste fuera del dashboard.

### QA01-DASH-003 - Dashboard desktop y mobile-web

Prioridad: media  
Plataforma: web

Pasos:
1. Abrir dashboard en `1440x900`.
2. Repetir en `390x844`.

Esperado:
- Desktop muestra Hero arriba y dos columnas debajo.
- Mobile-web apila secciones.
- Mobile-web no muestra Nuevo movimiento en header; usa FAB.
- Desktop no muestra FAB.

### QA01-SET-001 - Toggle de centavos

Prioridad: media  
Plataforma: web y mobile

Pasos:
1. Abrir Settings.
2. Desactivar visualizacion de centavos.
3. Volver a dashboard.
4. Reactivar centavos y recargar.

Esperado:
- Los importes ocultan o muestran centavos segun preferencia.
- La preferencia persiste tras recargar o reabrir.
- El ledger subyacente no cambia.

### QA01-SET-002 - Cambio de idioma

Prioridad: media  
Plataforma: web y mobile

Pasos:
1. Cambiar idioma a English.
2. Recorrer dashboard, Cuentas, Settings y navegacion.
3. Recargar web o cerrar y reabrir mobile.

Esperado:
- Los labels propios de producto se muestran en ingles.
- Los nombres cargados por QA, como `Galicia sueldo`, no se traducen.
- La preferencia persiste en la plataforma.
- Web usa cookie; mobile usa SecureStore. Cambiar una plataforma no sincroniza la otra.

### QA01-SHELL-001 - Navegacion web responsive

Prioridad: media  
Plataforma: web

Pasos:
1. En `1440x900`, recorrer Dashboard, Cuentas, Tarjetas, Movimientos y Settings.
2. Colapsar sidebar y recargar.
3. En `390x844`, abrir hamburger.
4. Presionar Escape.

Esperado:
- Sidebar desktop marca como activo el item de la ruta.
- El colapso persiste tras recarga.
- En mobile-web no hay sidebar desktop.
- Hamburger abre drawer full-screen y Escape lo cierra.

### QA01-SHELL-002 - Loading y error no rompen chrome

Prioridad: baja  
Plataforma: web y mobile

Pasos:
1. Simular red lenta al entrar en dashboard y Cuentas.
2. Simular error de fetch cuando el ambiente lo permita.

Esperado:
- Existe feedback de loading.
- El error ofrece retry o mensaje utilizable.
- La app no queda en blanco.
- Cuando aplica loading in-page, el chrome principal permanece visible.

## Checklist de cierre

| Control | Resultado |
|---|---|
| QA-A confirmado por OTP y con onboarding completo | Pendiente de ejecutar |
| Billetera ARS/USD provisionada | Pendiente de ejecutar |
| Galicia sueldo creada con ARS/USD | Pendiente de ejecutar |
| Hero esperado `$ 575.000,50` y `u$s 1.250,00` | Pendiente de ejecutar |
| Cuenta descartable eliminada | Pendiente de ejecutar |
| Institucion custom creada | Pendiente de ejecutar |
| Settings e i18n verificados | Pendiente de ejecutar |
| Navegacion responsive verificada | Pendiente de ejecutar |

## Dataset resultante para Instancia 02

Al cerrar esta guia, QA-A debe conservar:

| Cuenta | Tipo | ARS | USD | Observacion |
|---|---|---:|---:|---|
| Billetera | cash | `125000,50` | `250,00` | Provisionada en signup |
| Galicia sueldo | bank | `450000,00` | `1000,00` | Puede apuntar a institucion custom tras ACC-005 |
| Cooperativa ahorro | bank | `0,00` | `0,00` | Branding custom |

Saldo disponible esperado antes de movimientos:

| Moneda | Total |
|---|---:|
| ARS | `575000,50` |
| USD | `1250,00` |

## Proxima instancia

La Instancia 02 debe cargar ingresos, gastos, transferencia, ajuste y exchange sobre estas cuentas.
La progresion recomendada es: happy path ARS, ledger USD separado, edicion/borrado, filtros, orden
de display, detalle funcional, drawer web y finalmente aviso no bloqueante de saldo negativo.

