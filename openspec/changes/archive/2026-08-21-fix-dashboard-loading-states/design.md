## Context

El dashboard tiene cuatro bloques y cada uno resuelve su carga distinto por accidente, no por decisión: web "Cuánto gastaste" no tiene skeleton y muestra su copy de vacío mientras la query resuelve; el nativo muestra el skeleton del donut de "En qué se fue", una sección dada de baja; Compromisos nativo devuelve un skeleton pelado en lugar de la card, y el encabezado aparece de golpe; el saldo cubre solo el importe del hero y deja el resto en ceros. La tira Compartido no dibuja nada, que es lo correcto, pero tampoco está escrito.

El spec que debía gobernar esto quedó debilitado: al archivar `redesign-dashboard-home-v2` los requirements `MODIFIED` reemplazaron a los del master con menos contenido del que tenían, y se perdieron reglas vigentes (ver `proposal.md`). El master tampoco decide qué pasa con el chrome de la card durante la carga, ni con un bloque condicional.

## Goals / Non-Goals

**Goals:**

- Que el spec vuelva a contener las reglas que ya regían, y que además decida las tres cosas que el código tuvo que decidir solo.
- Que los cuatro bloques tengan un tratamiento de carga explícito y distinto donde corresponda.
- Que ningún bloque afirme algo falso mientras carga.
- Que las referencias a componentes dados de baja desaparezcan de los specs.

**Non-Goals:**

- Rediseñar la composición ni tocar lecturas, derivaciones o números.
- Unificar los skeletons en un componente compartido entre plataformas: web usa `div`+`animate-pulse` y nativo `SkeletonBlock`, y esa asimetría es la política del repo.
- Cubrir el refetch de `pull-to-refresh` en nativo con skeletons: ahí ya hay data en pantalla y el `RefreshControl` es el feedback.

## Decisions

**1. Tres tratamientos, no uno.** La regla "cada bloque muestra un skeleton" es demasiado gruesa para cuatro bloques que se comportan distinto:

| Bloque | Tratamiento | Por qué |
|---|---|---|
| Saldo disponible | Un skeleton de card completa | Dos lecturas, una sola card: por zona se arma a saltos. El rótulo y el importe SON el contenido, no chrome |
| Cuánto gastaste / Compromisos | Encabezado real + skeleton de cuerpo | El encabezado es texto estático y un link: no depende de la lectura, y esconderlo hace que la card aparezca de la nada en vez de llenarse |
| Compartido | Sin skeleton | Bloque condicional: existe solo con Hogar de dos y neto sin saldar. Un skeleton prometería algo que casi nunca aparece, y al resolver en nada haría saltar el layout |

Alternativa descartada para Compartido: reservar el alto siempre. Se descartó porque deja un hueco permanente en la mayoría de las cuentas, que no tienen Hogar.

**2. El estado vacío no es un placeholder.** Es la decisión que más código cambia. Hoy web deriva `isEmpty` de montos que valen 0 porque la query no resolvió, y termina afirmando "Sin gastos este mes". La regla queda escrita como prohibición explícita —ni copy de vacío ni ceros— y se implementa distinguiendo `isPending` de "resolvió en cero", que es la misma distinción entre cero y ausencia de dato que el spec ya exigía para el ritmo.

**3. La navegación de mes se trata como carga.** El `<Suspense>` de web solo cubre el primer render del servidor; los meses siguientes son queries de cliente. Sin regla explícita, cada bloque improvisa (hoy: ceros). Se decide que un mes sin datos vuelve al skeleton de cuerpo con el encabezado puesto, en las dos plataformas.

**4. Los deltas `MODIFIED` van completos.** Este change es la consecuencia directa de no haberlo hecho la vez anterior. Cada requirement modificado se copia entero del master y se edita, y la tarea de archivo lo verifica explícitamente.

## Risks / Trade-offs

- **El skeleton de "Cuánto gastaste" tiene que igualar tres tiles y una tira de ritmo** → si queda corto, el salto al resolver es peor que el vacío falso que reemplaza. Se ata al `min-height` que el spec ya exige y se verifica a ojo en los dos anchos.
- **Mover el saldo nativo a un skeleton de card completa oculta el hero, que hoy aparece antes** → es el precio de que la card no se arme a saltos; es la regla que el spec ya fijaba para web y que nativo nunca cumplió.
- **La rama `isPending` en web puede tapar el estado vacío real si se escribe mal** (`isPending` vs `isFetching`): un usuario sin gastos vería skeleton eterno. Se cubre con el escenario que exige que el vacío aparezca cuando la lectura resolvió en cero.
- **`dashboard.spending.loading` queda huérfana** al dar de baja el skeleton del donut nativo → se verifica que ningún otro módulo la consuma antes de borrarla; el bug 8.6 del change anterior nació exactamente de una limpieza de claves sin ese chequeo.

## Open Questions

Ninguna. Las tres decisiones de producto (chrome, Compartido, vacío falso) se acordaron antes de escribir el spec.
