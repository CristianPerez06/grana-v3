# Tasks: extract-savings-module

> **Sin migraciones.** Si este change termina tocando SQL, algo se entendió mal (E6).

## 1. La corrección documental, primero

- [ ] 1.1 `docs/modelo-de-dinero.md`: separar *"ahorro e inversión no son dos modelos de datos"* —que
  sigue valiendo— de *"no son un lugar en la app"*, que era una conclusión que la frase no sostenía.
  Va primero porque es la frase que bloqueó esta discusión durante tres fases
- [ ] 1.2 Anotar ahí mismo que la objeción a **«Invertir»** era contra esa palabra, no contra un
  módulo, y que *«Ahorro e inversión»* no la hereda
- [ ] 1.3 `AGENTS.md`: el módulo `16 savings` gana superficie propia; dejar dicho que `18 investments`
  se construye **adentro** de él y no como módulo aparte

## 2. Dibujar antes de construir

- [x] 2.1 Mock del módulo, con los números reales de agosto: `docs/design/modelo-de-dinero/modulo-ahorro-e-inversion.html`.
  **El corte de moneda quedó decidido y va contra la intuición inicial: sin tabs.** Las tres formas se
  compararon con el mismo dato, y dos ya habían sido descartadas en la fase 2 por el mismo usuario:
  apilar dos bloques (*"no sé si me convence que lo de USD esté abajo"*) y partir por moneda
  (*"no hay ninguna manera donde yo pueda ver cuánto tengo para Viaje en ARS y USD junto"*). Con tabs,
  un propósito bimoneda **no existe entero en ninguna pantalla**. La salida es la de D16: una lista con
  los dos montos por fila, sin sumarlos. El chip de moneda vive en los formularios, que es donde la
  moneda es un dato de la operación y no una estructura
- [x] 2.2 La jerarquía: **Guardado es el protagonista** en las dos monedas, y **«Para gastar» va de
  contexto en chico** — es el titular del dashboard, y dos pantallas con el mismo protagonista no dejan
  protagonista a ninguna (D16). Después el desglose, «Sin destino» al pie y las dos acciones
- [ ] 2.3 Dibujar la **puerta sobria** desde el dashboard: la fila de Guardado lleva al módulo sin
  convertir la card en su casa

## 3. La ruta y la entrada

- [ ] 3.1 Ruta web `/savings` (o el slug que salga de 2.2) con su layout y estados de carga
- [ ] 3.2 Entrada en el menú web (`app-menu.tsx`) y en el chrome mobile, con el mismo rótulo
- [ ] 3.3 Skeleton shell que matchee la forma real, como el resto de las secciones
- [ ] 3.4 Estado vacío (mockeado): el número en cero, **una sola acción**, y la frase que evita el
  malentendido —*"guardar no mueve tu plata"*—. Sin propósitos, sin «Sin destino» en cero, y **sin
  ningún rastro de inversiones**, aunque el módulo se llame así (E8)

## 4. Mover la operatoria

- [ ] 4.1 Montar en el módulo el detalle, el desglose y los formularios que hoy viven en el overlay
- [ ] 4.2 La fila de Guardado del dashboard **navega** en vez de abrir el overlay
- [ ] 4.3 La tira post-ingreso queda donde está, y su acción sigue resolviendo en el lugar (E3)
- [ ] 4.4 Verificar que ningún formulario de ahorro quedó montado en otra superficie

## 5. Lo que no se toca

- [ ] 5.1 Cero cambios en `availability_reserve`, `savings_purpose_allocation`, sus triggers y
  `write_reserve`
- [ ] 5.2 Cero filas nuevas en Cuentas y cero entradas nuevas en Movimientos
- [ ] 5.3 La identidad de la card del mes sigue cerrando, con los mismos números

## 6. QA

- [ ] 6.1 Guardar, volver a usar, destinar y quitar destino desde el módulo, con los mismos topes y
  pisos que antes
- [x] 6.2 **El default del origen al volver a usar** (E7) — **cerrado sin QA**: preseleccionar es
  aceptable mientras el chip esté visible y se pueda cambiar antes de confirmar; no es imputación
  silenciosa si está en pantalla. La regla completa: un solo grupo con saldo → directo al monto;
  varios y «Sin destino» con saldo → preseleccionado; varios y el resto en cero → **sin
  preselección**; desde un propósito → heredado. **Nunca se toca un propósito sin mostrarlo antes.**
  Falta verificar el tercer caso, que hoy no está implementado así
- [ ] 6.3 Bimoneda: nada suma ARS con USD en ninguna pantalla del módulo
- [ ] 6.4 Regresión del dashboard: ningún número cambió, la card cierra, la tira sigue apareciendo
- [ ] 6.5 QA nativo del módulo — **bloqueado por el mismo acceso que el issue #58**
- [ ] 6.6 `pnpm openspec:check`, lint, typecheck (web y mobile) y tests en verde

## 7. Compuertas

- [ ] 7.1 **No archivar** hasta el QA nativo, como las fases 1 y 2
- [ ] 7.2 **La fase 3A (plazo fijo) se construye adentro de este módulo** y por eso va después. El
  mock `fase-3a-plazo-fijo.html` hay que redibujarlo con la cuenta como **atajo contextual** y no
  como arquitectura
