## ADDED Requirements

### Requirement: La búsqueda de instituciones ignora mayúsculas y acentos

Toda superficie que ofrezca buscar una institución — alta y edición de cuenta, alta y edición de tarjeta, en web y en nativo — SHALL filtrar por nombre ignorando mayúsculas **y diacríticos**, plegando los acentos en los dos lados de la comparación: el nombre de la institución y el término tipeado. Una consulta acentuada SHALL seguir encontrando el nombre acentuado.

El matching SHALL implementarse una sola vez, en `filterInstitutions` de `@grana/accounts`, y las cuatro superficies SHALL consumirlo. NO SHALL reimplementarse por plataforma ni por formulario: un filtro paralelo es el patrón "mirror … keep in sync" que las convenciones del repo prohíben, y es lo que dejó pasar este bug.

El motivo es de producto, no de prolijidad: una institución del catálogo que no matchea su propio nombre se lee como ausente, y el dropdown ofrece "+ Agregar institución" justo debajo. El usuario termina creándose un duplicado custom de una entidad que ya existe, invisible para el resto y con otro color.

#### Scenario: Un término sin acento encuentra el nombre acentuado

- **WHEN** el usuario tipea `uala` en el buscador de instituciones
- **THEN** aparece `Ualá`
- **AND** tipear `nacion` hace aparecer `Nación`

#### Scenario: Un término acentuado sigue encontrando el nombre

- **WHEN** el usuario tipea `Ualá`
- **THEN** aparece `Ualá`

#### Scenario: Las cuatro superficies comparten el mismo matcher

- **WHEN** se agrega o corrige una regla de matching de instituciones
- **THEN** el cambio ocurre en `filterInstitutions` de `@grana/accounts`
- **AND** las cuatro superficies lo heredan sin editar ninguna de ellas
