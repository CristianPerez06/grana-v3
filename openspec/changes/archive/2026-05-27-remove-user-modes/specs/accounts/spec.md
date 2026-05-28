## REMOVED Requirements

### Requirement: En modo novato la creación de cuentas no está disponible en la UI

Se elimina este requirement (revierte el change `2026-05-26-hide-account-creation-novato`). Al desaparecer el modo `novato`, la creación de cuentas está disponible para **todos** los usuarios: el botón "Crear cuenta" siempre se muestra (listado y estado vacío) y la ruta `/accounts/new` no redirige. La profundidad la elige el usuario creando o no más cuentas; un hint de primer uso le explica que puede centralizar todo en la `Billetera` o crear cuentas para ver dónde está su plata.
