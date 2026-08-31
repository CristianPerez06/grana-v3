# QA de navegador — `mirror-native-chrome-on-web-mobile`

> **Qué cambió.** La web en viewport de teléfono dejó de ser «la web angosta» y pasa a **espejar el
> chrome de la app nativa**: header navy full-bleed, tab bar fija de cuatro slots
> (`Inicio · Movimientos · Hogar · ⋯`), menú como bottom sheet, y los `Drawer` presentándose como
> bottom sheets en vez de paneles laterales. **Solo el chrome**: el contenido de cada ruta no se tocó,
> y en escritorio no cambia nada.
>
> Son las verificaciones que quedaron abiertas en `tasks.md` §7 y 4.3/4.4. Es lo único que separa a
> esta change de poder archivarse.

## Resultado (29-ago-2026)

**Los siete de navegador, en verde**, corridos en Chrome DevTools a 390×844 (iPhone 12 Pro). Ninguno
destapó un hallazgo: el chrome nativo espejado en web-mobile funciona como se especificó.

Los dos que más riesgo tenían pasaron limpio:

- **el selector de banco y la calculadora** (caso 5) se dibujan los dos **adentro** del sheet, con su
  scroll propio. Era el único punto que hasta hoy se había verificado **leyendo el código**: el panel
  lateral alto se volvió un sheet bajo, y eso es justo lo que podía romperlos;
- **la acción de crear** (caso 7) está en el header en las cinco rutas que corresponden, y el botón
  flotante quedó solo donde tiene que quedar.

**Quedan los tres de teléfono** —el teclado (8), la PWA en iPhone (9) y Android (10)— más `6.1`, que
son los deltas de spec y se aplican **al** archivar.

### Los tres de teléfono — aceptados sin correr

**Decisión del QA (Juli, 29-ago-2026): se aceptan sin correr.** Van por escrito, no tildados: nadie
vio este chrome con un teclado virtual real ni instalado como PWA.

*Por qué no se corrieron.* Los tres necesitan un dispositivo. El teclado porque `visualViewport` solo
se mueve con un teclado virtual real; la PWA porque `env(safe-area-inset-*)` solo resuelve en iOS
standalone; Android porque no había uno a mano. Chrome DevTools no puede simular ninguno de los tres —
sus «Pixel» y «Galaxy» son el mismo motor de escritorio en otro tamaño.

*Qué se estaría llevando puesto si fallan.*
- **El teclado (8):** la tab bar se queda arriba del teclado, o el sheet queda debajo. Molesto y
  visible al primer uso, no destructivo: no hay pérdida de datos.
- **La PWA (9):** una banda blanca entre el notch y el navy, o la barra pisada por la home indicator.
  Es puramente cosmético, y **solo en la web instalada** — en Safari normal no aplica.
- **Android (10):** lo mismo que 8, con el teclado y los insets de Android.

*Por qué el riesgo es acotado.* No es código sin escribir. El esconder la barra está implementado con
`visualViewport` (decisión 2 del design) y el `viewport-fit=cover` con `env(safe-area-inset-*)` ya
está puesto — lo que falta es verlos, no hacerlos. Y los siete casos de navegador, que son los que
ejercen la estructura del chrome, pasaron sin un solo hallazgo.

*Qué los reabre.* El primer reporte de «la barra me tapa el teclado» o «hay una franja blanca arriba»,
y la primera vez que alguien instale la PWA en un teléfono. Son baratos de correr: el 8 y el 9 son
tres minutos con un iPhone en la misma red que `localhost:3000`.

## Antes de empezar

- Chrome DevTools en **390px** de ancho (iPhone 14 Pro en el selector de dispositivos).
- Sesión iniciada, con al menos una cuenta y un movimiento.
- Mirá también **una vez en 800px** (el caso 5), que es donde tiene que volver el escritorio.

---

## 1 · La tab bar y el header, en `/transactions`

| | |
|---|---|
| **Qué mirar** | El **header navy pegado al tope**, sin barra blanca arriba. La **tab bar fija abajo** con «Movimientos» marcado. El botón flotante de agregar **sin apoyarse sobre la barra** |
| **Sería bug** | Una topbar blanca con hamburguesa (el chrome viejo) · la barra scrollea con el contenido en vez de quedar fija · el botón flotante pisa la barra o queda tapado · el navy no llega al borde y deja franjas blancas a los costados |
| **Puede variar** | El alto exacto del header depende del safe-area simulado. No es bug si el navy llega al tope |

## 2 · El menú `⋯`

| | |
|---|---|
| **Qué mirar** | Que **suba desde abajo como sheet**, por encima de la tab bar. Que muestre la **identidad** (tu nombre / cuenta) y los ítems que bajaron del sidebar: **Cuentas, Tarjetas, Ahorro e inversión y Ajustes** |
| **Interacción** | Abrirlo, tocar el scrim → **cierra** |
| **Sería bug** | Se abre como panel lateral · queda por debajo de la tab bar · falta la identidad o alguno de los ítems · el scrim no cierra |

## 3 · Una sección sin barra (chromeless)

| | |
|---|---|
| **Qué mirar** | Entrar a **Cuentas desde el menú**: la sección se dibuja **sin tab bar**, y a cambio tiene **back-link a Inicio** |
| **Interacción** | Tocar el back-link → vuelve a Inicio |
| **Sería bug** | La tab bar sigue abajo · no hay back-link, o lo hay y no vuelve · vuelve pero rompe el historial |
| **Por qué importa** | Es la regla que se importó del nativo: lo que cuelga del menú no tiene barra, y por eso **debe** declarar su vuelta |

## 4 · El escritorio vuelve — 800px

| | |
|---|---|
| **Qué mirar** | Redimensionar a **800px**: vuelve el **sidebar**, desaparecen la **tab bar** y el **botón flotante**, y los headers vuelven al flujo del contenido (sin banda navy full-bleed) |
| **Sería bug** | Queda la tab bar en escritorio · queda el botón flotante · el header sigue navy a todo el ancho · el sidebar no vuelve |
| **Por qué importa** | El corte es en `md` (768px). Este caso es el que confirma que **escritorio no se tocó** |

## 5 · Los dos overlays que se dibujan adentro del panel

| | |
|---|---|
| **Qué mirar** | A 390px, abrir el **alta de cuenta**: el **selector de banco** despliega su lista **dentro del sheet** y scrollea con el dedo. Lo mismo con la **calculadora de monto** |
| **Sería bug** | La lista se corta y no se puede scrollear · se dibuja fuera del sheet, tapada o a mitad de pantalla · se abre hacia abajo y queda fuera de la vista en vez de flipear hacia arriba |
| **Por qué importa** | Son los **únicos dos** que se portalean adentro del panel. Que el sheet sea más bajo que un panel lateral es justo lo que puede romperlos, y hasta ahora solo se verificó **leyendo el código** |

## 6 · Un sheet con poco contenido

| | |
|---|---|
| **Qué mirar** | A 390px, abrir un drawer corto —por ejemplo **editar el nombre del hogar**—: el sheet **hugea su alto**, ocupa lo que mide su contenido |
| **Sería bug** | Ocupa la pantalla entera para mostrar dos campos · queda un hueco vacío abajo · el grabber no aparece |

## 7 · Dónde está la acción de crear

| | |
|---|---|
| **Qué mirar** | A 390px, recorrer **`/accounts`, `/cards`, `/settings/categories`, `/transactions/recurring` y `/cards/[id]`**: la acción de crear está **en el header, arriba a la derecha, en verde**, y **no hay ningún botón flotante**. En **`/dashboard`, `/transactions` y `/shared`** el botón flotante **sí sigue** |
| **Sería bug** | Queda un flotante en las cinco primeras · desapareció el de las tres últimas · la acción de crear no está en ningún lado |
| **Por qué importa** | Es la corrección posterior a review (3.13): un solo botón flotante en todo el producto, como en el nativo |

---

## Los tres que necesitan teléfono

DevTools **no** puede verificar ninguno de estos, y conviene decirlo antes de que alguien los tilde
mirando el simulador.

## 8 · El teclado esconde la barra *(teléfono, cualquier navegador)*

| | |
|---|---|
| **Qué mirar** | En `/transactions`, abrir el alta y **enfocar el monto**: la tab bar **se esconde**, el sheet queda **por encima del teclado**, y la barra **vuelve** al cerrarlo |
| **Sería bug** | La barra se queda y el teclado la empuja fuera de lugar · el sheet queda debajo del teclado · la barra no vuelve |
| **Por qué no sirve DevTools** | Se implementó con `visualViewport`, que **solo se mueve con un teclado virtual real** (decisión 2 del design). En el simulador de escritorio no pasa nada |

## 9 · La PWA en un iPhone real

| | |
|---|---|
| **Qué mirar** | Instalar la web en la pantalla de inicio y abrirla: el **navy llega hasta el notch** y la **tab bar respeta la home indicator** |
| **Sería bug** | Banda blanca arriba del navy · la barra queda debajo de la home indicator o pisada por ella |
| **Por qué no sirve DevTools** | `env(safe-area-inset-*)` solo resuelve en iOS **standalone**. Es literalmente lo único que el navegador de escritorio no puede simular |

## 10 · Android

| | |
|---|---|
| **Qué mirar** | Repetir los casos **1** y **8** en un Android |
| **Por qué aparte** | El teclado y los insets se comportan distinto que en iOS, y es donde más veces nos mordió |

---

## Cómo cerrar

1. **Todo en verde** → se archiva la change (tarea 6.1: los deltas de spec se aplican **al** archivar).
2. **Algo roto** → se arregla, y se vuelve a correr ese caso más los dos que lo rodean.
3. **Algo que no se puede correr** → **excepción escrita**, nunca tildado: por qué no se corrió, qué se
   lleva puesto si falla, por qué el riesgo es bajo, y qué la reabre. Es la misma forma que usó el
   caso 11 del QA de ahorro (`docs/qa-savings-nativo.md`).
