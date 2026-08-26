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

- [ ] 2.1 Mock del módulo, con los números reales de agosto. Decidir el corte de moneda —selector,
  tabs o apilado— mirando las dos versiones (E5, y D16 de la fase 2)
- [ ] 2.2 Decidir la jerarquía: qué es lo primero que se lee al entrar
- [ ] 2.3 Dibujar la **puerta sobria** desde el dashboard: la fila de Guardado lleva al módulo sin
  convertir la card en su casa

## 3. La ruta y la entrada

- [ ] 3.1 Ruta web `/savings` (o el slug que salga de 2.2) con su layout y estados de carga
- [ ] 3.2 Entrada en el menú web (`app-menu.tsx`) y en el chrome mobile, con el mismo rótulo
- [ ] 3.3 Skeleton shell que matchee la forma real, como el resto de las secciones
- [ ] 3.4 Estado vacío: alguien que nunca guardó nada entra igual y entiende qué es

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
- [ ] 6.2 **El default del origen al volver a usar** (E7): probar con y sin preselección de «Sin
  destino», y decidir mirando
- [ ] 6.3 Bimoneda: nada suma ARS con USD en ninguna pantalla del módulo
- [ ] 6.4 Regresión del dashboard: ningún número cambió, la card cierra, la tira sigue apareciendo
- [ ] 6.5 QA nativo del módulo — **bloqueado por el mismo acceso que el issue #58**
- [ ] 6.6 `pnpm openspec:check`, lint, typecheck (web y mobile) y tests en verde

## 7. Compuertas

- [ ] 7.1 **No archivar** hasta el QA nativo, como las fases 1 y 2
- [ ] 7.2 **La fase 3A (plazo fijo) se construye adentro de este módulo** y por eso va después. El
  mock `fase-3a-plazo-fijo.html` hay que redibujarlo con la cuenta como **atajo contextual** y no
  como arquitectura
