/**
 * Encuadre del detalle de una regla. El «volver» NO vive acá: un layout no
 * recibe los parámetros de la URL, y adónde se vuelve depende de cómo se llegó
 * —del hub o de la ficha de un movimiento vinculado—. Lo dibuja la página.
 */
const RecurrenceDetailLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex max-w-2xl flex-col gap-8">{children}</div>
)

export default RecurrenceDetailLayout
