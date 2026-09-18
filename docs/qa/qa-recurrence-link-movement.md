# QA — `recurrence-link-movement`

> **Este código nunca se ejecutó contra la base real.** El change está implementado y archivado, y
> `pnpm verify` corrió **de punta a punta en verde** después de la segunda ronda de revisión (tests
> del monorepo, lint y typecheck de web y nativo, build, checks de salud y el validador de OpenSpec).
> Nada de eso dibuja una pantalla: los tests nuevos corren SQL en un Postgres embebido (PGlite) y
> TypeScript compara tipos. Todo lo de acá abajo se mira corriendo la app.
>
> Lo que **ya está probado y no hace falta re-verificar a mano**: el conteo de posiciones
> (SQL↔TS, 10 casos), las guardas de liquidación (11 casos, incluido el defecto que reparan), y los
> tres RPC con el circuito completo vincular → convertir → liquidar → revertir/cancelar → desvincular
> (28 casos). Lo que falta es que **las superficies dibujen y se comporten**, y que todo eso funcione
> contra la base online y no contra un doble.

## 0 · Prerrequisitos — sin esto no arranca nada

| | Qué | Cómo se sabe que salió bien |
|---|---|---|
| 0.1 | Aplicar `supabase/migrations/0072_recurrence_link_movement.sql` en el SQL Editor | Corre entera sin error. Tiene un self-check antes del `COMMIT`: si algo falta, aborta y dice qué |
| 0.2 | ~~Regenerar los tipos~~ — **no aplica**: la CLI de Supabase no se usa en este proyecto (ver `AGENTS.md`). Las firmas de `packages/supabase/src/types.ts` están escritas a mano y se compararon una por una contra el SQL de 0072: nombres y orden de los parámetros, cuáles tienen default, y la forma del retorno | Esa comparación, ya hecha, más `pnpm typecheck` y `pnpm typecheck:mobile` en verde. **Cubre las firmas de este change, no el esquema entero**: el typecheck no compara este archivo contra la base |
| 0.3 | Tener a mano una regla **mensual activa** cuyo próximo vencimiento **todavía no llegó** | El hub la muestra con «Próximo: …» |

**Si 0.1 no corrió, todo lo demás falla al primer toque** y no significa nada: los tres RPC no existen.

---

## A · «Ya lo pagué», antes de que venza

Es el síntoma original: el alquiler vence el 23 y lo pagás el 3.

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Abrir el hub de recurrencias | La fila del vencimiento futuro ahora ofrece **«Ya lo pagué»** y **«Ya lo tengo cargado»**. Antes no ofrecía nada, y la tarjeta decía «Solo informativo»; ahora la nota dice que se puede registrar o vincular |
| A2 | Tocar «Ya lo pagué» | **Se abre un formulario**, no se crea nada todavía: fecha de pago en **hoy** y editable, importe y cuenta de la regla, editables. El botón de confirmar queda **deshabilitado hasta que carguen las cuentas** |
| A2b | Cambiar el importe y confirmar | El movimiento se crea con el importe que pusiste y **el importe de la regla no cambia** |
| A2c | Elegir una cuenta cuyo saldo no alcanza | Aparece la advertencia de saldo negativo **antes** de confirmar. No bloquea |
| A2d | Confirmar | Se crea el movimiento con la fecha de pago elegida, y el saldo de esa cuenta baja |
| A2e | Lo mismo desde **el detalle de la regla** | Las dos acciones también están ahí, con el mismo formulario |
| A3 | Volver al hub | **El próximo vencimiento NO se movió.** Si la regla vencía el 23 de octubre, sigue siendo el 23 de octubre — no «un mes desde hoy» |
| A4 | Mirar «Vencimientos por revisar» | **No aparece nada nuevo de esa regla.** Este es el caso trampa: una ocurrencia pendiente con fecha futura le pediría al usuario algo que acaba de pagar |
| A5 | Correr el check SQL de abajo | La ocurrencia existe con `status='confirmed'`, `resolution_kind='created'` y el `due_date` **original** (el 23), no la fecha de pago |

**Falla si**: el próximo vencimiento se corre, o si aparece un pendiente futuro aunque sea un instante.

---

## B · «Ya lo tengo cargado»

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B0 | Correr `qa-recurrence-link-movement-bloque-b.sql` (misma carpeta) | Dice con qué regla conviene probar y **con qué fecha, cuenta, moneda e importe** cargar el movimiento. La ventana sale del calendario real de la regla, así que «20 días antes» sólo entra en una mensual |
| B1 | Cargar ese gasto DESDE LA APP, con los datos que dio B0 | — |
| B2 | Tocar «Ya lo tengo cargado» | El gasto aparece en la lista. **Veinte días antes tiene que entrar**: es el caso que motiva todo el change |
| B3 | Cargar otro gasto con un importe **muy distinto** (el alquiler aumentó) | **También aparece.** El monto ordena, no filtra. Debajo dice en qué difiere, como información — no como advertencia |
| B4 | Mirar el pie de la lista | **«Ampliar la búsqueda» está visible aunque la lista ya tenga candidatos**, no sólo cuando queda vacía |
| B5 | Elegir uno y vincular | **No se crea ningún movimiento nuevo.** El saldo no se mueve ni un peso: ese gasto ya estaba contado |
| B6 | Abrir la ficha de ese movimiento | Dice **«Vinculado a esta recurrencia»**, no «Generado por una regla recurrente» |
| B7 | Abrir los candidatos de **otro** vencimiento de la misma regla | Ese movimiento **ya no aparece**: uno resuelve un solo vencimiento |

---

## C · Desvincular

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | En el detalle de la regla, sobre la ocurrencia vinculada en B, tocar **«Desvincular»** | El **movimiento sigue existiendo** y vuelve a estar suelto. No se borra: la recurrencia no lo creó |
| C2 | Mirar la ocurrencia | Volvió a **«por revisar»**, conservando su vencimiento. **No quedó omitida** |
| C3 | Buscar «Desvincular» sobre la ocurrencia de **A2d** (la que la app creó) | **No se ofrece.** Deshacer eso significaría borrar un gasto real, que es otra operación (#104) |
| C4 | Volver a vincular otro movimiento al mismo vencimiento | Se resuelve, y **la regla no gana un vencimiento extra** |

---

## D · Compartido — la parte cara

Necesita un hogar de dos miembros y una regla de gasto compartida.

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | Vincular un movimiento **personal** a la regla compartida | **Pide confirmación explícita** y explica que el gasto va a pasar a ser compartido |
| D2 | Cancelar esa confirmación | **Nada cambió**: el movimiento sigue personal y el vencimiento sin resolver |
| D3 | Repetir y confirmar | El gasto queda compartido con el reparto de la regla, y **la deuda del hogar se mueve** |
| D4 | Desvincular | Vuelve a **personal**, sin reparto, y **la deuda vuelve a donde estaba** |
| D5 | Tener un movimiento compartido con **otro reparto** dentro de la ventana | **No aparece** entre los candidatos |
| D6 | Volver a hacer D3. Después registrar una **liquidación completada** posterior al gasto. Intentar desvincular | **Falla y NO cambia nada**: el gasto sigue compartido **y el vínculo sigue puesto**. El mensaje dice que hay que **revertir** esa liquidación |
| D7 | Revertir esa liquidación e intentar de nuevo | **Ahora sí desvincula.** Este es el arreglo de fondo: antes revertir no destrababa nada |
| D8 | Repetir D6 con una liquidación **pendiente de asignación registrada por vos** | El mensaje dice **cancelar**, no revertir |
| D9 | Lo mismo, pero registrada por **la otra persona** | El mensaje dice que **la tiene que cancelar quien la registró**, y no te pide a vos que hagas nada |

**Falla si** en D6 el vínculo se suelta y el gasto queda compartido: eso es el deshacer parcial que el
change prohíbe. **Falla si** en D8 el mensaje dice «revertir»: sobre una pendiente esa operación no
existe.

---

## E · El límite

Con una regla de `max_occurrences = 3` cuyo primer vencimiento no llegó.

| | Qué hacer | Qué muestra el detalle |
|---|---|---|
| E1 | Abrir el detalle | **0 de 3** |
| E2 | Registrar el primero por anticipado | **1 de 3**, quedan los otros dos |
| E3 | Desvincular **antes** de que llegue esa fecha | Vuelve a **0 de 3** |
| E4 | Desvincular **después** de que pasó | Sigue en **1 de 3** — la fecha ya transcurrió |

En los cuatro casos el plan conserva **tres** posiciones. **Falla si** aparece una cuarta.

---

## F · Las dos superficies mobile

`AGENTS.md` cuenta dos: **web a ancho de teléfono** y **la app nativa**. Repetir **A, B y C** en las dos.

| | Qué mirar |
|---|---|
| F1 | Los dos botones entran en la fila sin romper el monto ni el nombre de la regla — en el hub web, en el **hub nativo** (debajo de cada regla activa) y en los dos detalles |
| F1b | En nativo, «Ya lo pagué» registra directo con los valores de la regla y la fecha de hoy, **sin formulario**: es la divergencia que el spec fija para la app nativa |
| F2 | En nativo, la hoja de candidatos **scrollea** — si la lista es larga y no se mueve, el tope de altura no está haciendo efecto |
| F3 | El rótulo «Vinculado» aparece en la ficha del movimiento **también en nativo** (antes no mostraba ningún vínculo) |
| F4 | Los mensajes de error son los mismos textos en las dos plataformas |

---

## Check SQL

`qa-recurrence-link-movement-check.sql`, en esta misma carpeta. Contesta lo que la pantalla no
muestra: con qué identidad quedó cada ocurrencia, si alguna quedó pendiente con fecha futura, y si
algún movimiento resuelve más de un vencimiento.

## Resultado

_(a completar al correrlo: qué casos pasaron, qué hallazgos salieron, qué se aceptó sin correr y por qué)_
