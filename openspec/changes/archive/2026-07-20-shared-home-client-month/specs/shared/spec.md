## ADDED Requirements

### Requirement: El home de Compartido navega el mes y carga las secciones sin recargar la página

El home de Compartido (`apps/web`, hogar activo de dos miembros) SHALL entregar su
navegación de mes y sus secciones con el mismo modelo híbrido RSC + estado de cliente
del dashboard. Este requisito define la **mecánica de entrega**; el contenido y la
semántica de cada sección (y que la deuda y la proyección son "hoy") siguen definidos en
"El usuario puede ver el dashboard del hogar".

- **Mes en estado de cliente, no en la URL.** El mes seleccionado SHALL vivir en estado
  de cliente (un proveedor de contexto propio del home), NO en `searchParams`. Cambiar de
  mes NO SHALL navegar ni recargar la ruta. El estado no se persiste: al montar el home
  se abre en el mes corriente (derivado server-side de la fecha financiera). El navegador
  SHALL deshabilitar la flecha "anterior" al alcanzar el límite de meses hacia atrás y la
  flecha "siguiente" en el mes corriente.

- **Chrome siempre visible, deshabilitado hasta estar listo.** El título del hogar, el CTA
  de alta de movimiento, el ícono de Configuración y el **navegador de mes** SHALL estar
  presentes desde el primer render. Los controles interactivos (flechas del navegador, CTA
  de alta) SHALL renderizarse **deshabilitados** hasta que su dependencia resuelva
  (datos / drawer de movimiento), sin ocultar el chrome ni reemplazarlo por un skeleton de
  header.

- **Secciones independientes.** Cada sección (Gasto del hogar, Qué se deben hoy, Lo que se
  viene, Últimos movimientos) SHALL cargar y fallar de forma independiente: cada una con su
  propio límite de carga (skeleton por sección) y su propio estado de error. Una sección
  lenta o en error NO SHALL bloquear a las demás. Las secciones scopeadas por mes (que
  obtienen desde el cliente) SHALL ofrecer **reintento en tarjeta** en su estado de error.
  El mes corriente SHALL renderizarse desde el servidor (seed) para pintar al instante; los
  meses no corrientes de las secciones scopeadas por mes se obtienen desde el cliente
  mostrando el skeleton en tarjeta mientras cargan.

- **Scope por mes vs "hoy".** Solo **Gasto del hogar** y **Últimos movimientos** SHALL
  reobtener datos al cambiar el mes (su clave de lectura incluye el mes seleccionado).
  **Qué se deben hoy** y **Lo que se viene** SHALL permanecer ancladas a "hoy": su lectura
  NO SHALL incluir el mes seleccionado en su clave ni reobtener al navegar el mes.

#### Scenario: Cambiar de mes no recarga la ruta

- **WHEN** el usuario toca una flecha del navegador de mes
- **THEN** el mes seleccionado cambia en estado de cliente sin navegación ni recarga de la ruta (la URL no cambia)
- **AND** solo Gasto del hogar y Últimos movimientos reobtienen datos para el mes nuevo
- **AND** Qué se deben hoy y Lo que se viene permanecen sin cambios

#### Scenario: El chrome del header aparece desde el primer render, deshabilitado hasta estar listo

- **WHEN** el home se está cargando por primera vez
- **THEN** el título del hogar, el navegador de mes, el CTA de alta y el ícono de Configuración están visibles
- **AND** las flechas del navegador y el CTA de alta están deshabilitados hasta que sus datos/drawer resuelven
- **AND** el header nunca se reemplaza por un skeleton

#### Scenario: Una sección en error no bloquea a las demás

- **WHEN** la lectura de una sección falla
- **THEN** esa sección muestra su propio estado de error en tarjeta (con acción de reintento en las secciones scopeadas por mes)
- **AND** las demás secciones se renderizan normalmente con sus propios datos

#### Scenario: Un mes no corriente se obtiene desde el cliente con skeleton en tarjeta

- **WHEN** el usuario navega a un mes distinto del corriente
- **THEN** Gasto del hogar y Últimos movimientos muestran su skeleton en tarjeta mientras obtienen los datos del mes desde el cliente
- **AND** al resolver muestran los datos del mes seleccionado sin haber navegado la ruta
