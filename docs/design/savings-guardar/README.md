# Circuito de Guardar — simulación de pantallas (fase 1)

Simulación del circuito completo de la **fase 1 del modelo de dinero** (`docs/modelo-de-dinero.md`):
un mes de punta a punta —cobrar, guardar, poner plata a plazo fijo y ver dónde quedó todo—
con cada pieza etiquetada según se construya de cero, se modifique o ya funcione hoy.

- `circuito-guardar.html` — abrir en el navegador. Ocho pantallas, con los mismos números
  atravesando todas para que la aritmética se pueda seguir.

**No es diseño final.** Es una referencia de producto para validar el circuito antes de escribir
las specs: qué pantalla responde qué pregunta, qué se reutiliza y qué hay que construir.
Los estilos usan los tokens reales de `@grana/ui-tokens` (navy, emerald, Plus Jakarta Sans) para
que el mock se lea como Grana, pero el HTML **no es código de producción**.

## Qué muestra

| # | Pantalla | Estado |
|---|---|---|
| 1 | Confirmar el sueldo (recurrencias pendientes) | Sin cambios |
| 2 | Tira "¿guardás $200.000?" | Nueva (sobre `guidance`) |
| 3 | Drawer de Guardar | Nueva (sobre `Drawer`) |
| 4 | Dashboard — card de saldo | Modificada |
| 5 | Detalle de Guardado | Nueva (fuera de la navegación) |
| 6 | Alta de cuenta con tipo de vehículo | Modificada |
| 7 | Transferencia al plazo fijo | Sin cambios |
| 8 | Cuentas en dos bloques, agrupadas por tipo | Modificada |

## Decisiones que la simulación fija

- El hero muestra **un solo monto**: el disponible real.
- Las dos líneas bajo la regla (`Pasaste a otra cuenta`, `Guardaste este mes`) están separadas
  de la tira de tres porque **son otra naturaleza**: hecho vs decisión.
- La identidad sigue cerrando en pantalla:
  `Tenías + Entró − Se fué − Pasaste − Guardaste = Disponible`.
- Una cuenta **por banco**, no por cada plazo fijo. El agrupado por tipo es un `group by`,
  no una entidad nueva.
- El guardado se muestra como **línea del grupo** en Cuentas, nunca pegado a una cuenta.

## Abierto

- Vencimiento individual de cada colocación (fase 3, junto con la valuación).
- Catálogo definitivo de tipos de cuenta.
