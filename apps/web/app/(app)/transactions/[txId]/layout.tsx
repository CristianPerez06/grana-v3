// El detalle del movimiento maneja su propio chrome (topbar con "Volver" +
// acciones) y su propio ancho (panel centrado ~760px). La edición, en cambio,
// es un formulario angosto: arma su chrome (back-link + max-w-lg) en su page.
// Por eso este layout es un passthrough — cada page define su ancho.
const TransactionDetailLayout = ({ children }: { children: React.ReactNode }) => <>{children}</>

export default TransactionDetailLayout
