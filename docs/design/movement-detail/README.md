# Handoff — Detalle de movimiento (Grana)

Pantalla de detalle de UN movimiento. **Responsive**: desktop (panel centrado ~760px)
y mobile (una columna). El mobile NO es un componente aparte: sale del breakpoint
`≤600px` definido en `panel.css`.

## Archivos de esta carpeta
| Archivo | Qué es | ¿Va al repo? |
|---|---|---|
| `panel.css` | **Fuente de verdad** de estilos: tokens, layout desktop y breakpoint mobile | Sí (portar a vuestro sistema) |
| `tipo-gasto-simple.html` | Referencia visual — gasto de pago único | Solo referencia |
| `tipo-cuotas.html` | Referencia — gasto en cuotas | Solo referencia |
| `tipo-compartido.html` | Referencia — gasto compartido entre personas | Solo referencia |
| `tipo-reintegro.html` | Referencia — gasto con reintegro asociado | Solo referencia |
| `tipo-recurrencia.html` | Referencia — gasto recurrente | Solo referencia |
| `tipo-ingreso.html` | Referencia — ingreso / sueldo | Solo referencia |
| `tipo-transferencia.html` | Referencia — transferencia entre cuentas propias | Solo referencia |
| `design-canvas.jsx`, `ios-frame.jsx` | Solo para los canvas de review | **No** |

Cada `tipo-*.html` es desktop + mobile a la vez: achicá la ventana a <600px para ver
el mobile.

---

## Anatomía (fija para todos los tipos)
1. **Topbar** — volver + acciones. Desktop: Duplicar, (Convertir en recurrencia en
   gastos / Ver serie en recurrencia), Eliminar, **Editar**. Mobile: acciones
   secundarias colapsan en un menú `···` y **Editar** pasa a una barra fija abajo.
2. **Hero** — ícono de categoría (cuadro redondeado tintado), título, **monto grande**,
   línea de contexto, y fila de chips: `fecha` · `medio de pago` · `categoría` ·
   `subcategoría`.
3. **Grilla "de un vistazo"** — tiles (2 col desktop, 1 col mobile) que cambian por tipo.
   **El "Peso en el mes" va siempre al final** (primero el detalle, después el contexto).

El color del monto/hero lo define el TIPO:
- gasto → terracotta `#B56A5A`, signo `−` (U+2212)
- ingreso → emerald-deep `#0E9E6E`, signo `+`
- transferencia → slate `#3A6B8A`, **sin signo**

Se setea con una clase en el contenedor raíz: `gasto` (default) / `ingreso` / `transfer`.

---

## Tiles por tipo
- **gasto-simple** → Pagado con · Detalle (fecha) · Descripción · Peso en el mes
- **cuotas** → En cuotas (barra pagadas/restantes + próxima + fin) · Pagado con ·
  Detalle (total + valor cuota) · Descripción · Peso en el mes
- **compartido** → Te toca pagar (tu parte) · Pagado con · Dividido entre (personas con
  estado: tu parte / te debe / saldado) · Detalle · Descripción
- **reintegro** → Resultado neto (pagaste + reintegro = costo neto + movimiento
  vinculado clickeable) · Pagado con · Detalle · Descripción
- **recurrencia** → Recurrencia (próximo cobro, activa desde, nº cobros) · Pagado con
  (acumulado) · Historial de cobros (barras 6 meses) · Descripción
- **ingreso** → Acreditado en · Detalle (origen) · Descripción · Peso del mes (% de ingresos)
- **transferencia** → Movimiento (origen → destino) · Callout "no cuenta como gasto/
  ingreso" · Detalle · Descripción

---

## Contrato de datos (mapear al modelo real del repo)
Campos comunes:
`id, tipo ('gasto'|'ingreso'|'transfer'), subtipo ('simple'|'cuotas'|'compartido'|
'reintegro'|'recurrente'), titulo, monto, fecha (SOLO fecha, sin hora), categoria,
subcategoria, icono, descripcion, medioDePago { nombre, tipo: 'efectivo'|'debito'|
'credito'|'cuenta' }`

Por tipo:
- cuotas: `{ cuotaActual, totalCuotas, valorCuota, montoTotal, proximaFecha, fechaFin }`
- compartido: `{ montoTotal, tuParte, personas: [{ nombre, monto, estado }] }`
- reintegro: `{ montoPagado, montoReintegro, costoNeto, reintegroVinculado: { id, fuente, fecha, monto } }`
- recurrente: `{ frecuencia, proximoCobro, activaDesde, cantidadCobros, acumulado, historial: [{ mes, monto }] }`
- transfer: `{ cuentaOrigen, cuentaDestino, saldoDestino }`
- ingreso: `{ origen, cuentaDestino, pesoEnIngresos }`

### Reglas de negocio
- **App de gestión, NO opera pagos**: nunca mostrar número de tarjeta. Solo nombre +
  tipo de la tarjeta/cuenta.
- **Sin hora**: los movimientos solo guardan fecha.
- **Sin estado "confirmado"**: no existe ese concepto. Solo mostrar estado cuando
  informa algo real: *Reintegrado*, *Completada* (transfer), *Acreditado* (ingreso).
- Transferencias **no** afectan el balance del mes (no son gasto ni ingreso).

---

## Estilo
- Tomar los valores EXACTOS de `panel.css` (radios card 18–24px, tile padding,
  hero icon 72/88px, ring, barras de cuotas, etc.). Convertir a vuestro sistema
  (CSS modules / styled / lo que use el repo) **sin cambiar valores**.
- Moneda AR: miles con `.`, decimales con `,`. Números con `tabular-nums`.
- Tipografía: **Plus Jakarta Sans**, pesos 400–800.
- Reusar el objeto de paleta `R` y los tokens existentes — NO duplicar colores.

## Antes de tocar nada
1. Explorar cómo está hecha la lista de movimientos, el modelo de datos y el routing.
2. Reusar el ítem de lista, helpers de formato de moneda y la tipografía existentes.
3. No modificar componentes compartidos salvo que sea imprescindible (manteniendo su
   API). Cero regresiones en lista, alta y dashboard. Correr build/lint al final.

## Entregable
- Componente(s) del detalle + wiring desde la fila de la lista (abrir al tocar).
- Decidir con el equipo: ruta (página) vs panel/modal. La app es mobile-first, así que
  el mobile es el caso principal; el desktop es el mismo layout a 2 columnas.
- Acciones cableadas a handlers existentes (editar/eliminar/duplicar) o stubs marcados.
- Estados de carga/empty si la data viene del backend.
