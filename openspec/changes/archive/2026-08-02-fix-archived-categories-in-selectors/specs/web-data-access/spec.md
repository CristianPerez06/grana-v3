# web-data-access — delta

## ADDED Requirements

### Requirement: Toda mutación de un catálogo cacheado invalida su query key

Un **catálogo** es una lectura de referencia que muchas pantallas consumen y que el usuario administra desde otra pantalla (categorías con sus subcategorías, cuentas, instituciones). Los catálogos se cachean con `staleTime` largo justamente porque cambian poco; esa política los vuelve incorrectos apenas cambian, salvo que alguien lo avise.

Toda mutación que crea, edita, archiva o elimina una fila de un catálogo SHALL invalidar la query key de ese catálogo en el cliente que la ejecutó, en la misma interacción. La invalidación SHALL ocurrir en **todas** las plataformas que cachean ese catálogo, cada una sobre su propia key.

`revalidatePath` de una server action NO SHALL contarse como invalidación: opera sobre el cache de rutas del servidor y no toca el cache de TanStack en el browser. Una mutación server-action que afecta un catálogo cacheado SHALL invalidar además desde el cliente que la invoca.

La consecuencia observable es que **ninguna pantalla ofrece una fila de catálogo que ya no existe o que el usuario acaba de archivar**. El `staleTime` gobierna cuándo revalidar un catálogo que nadie tocó; no es un plazo de gracia para servir datos que la propia app sabe que cambiaron.

#### Scenario: Archivar una categoría invalida el árbol de categorías

- **WHEN** el usuario archiva una categoría desde Configuración
- **THEN** la mutación invalida la query key del árbol de categorías en el cliente
- **AND** el siguiente consumer que monte —el selector del formulario de movimientos, por ejemplo— lee un árbol sin esa categoría, sin esperar a que venza el `staleTime`

#### Scenario: Eliminar una subcategoría invalida el árbol de categorías

- **WHEN** el usuario elimina definitivamente una subcategoría propia sin uso
- **THEN** la mutación invalida la query key del árbol de categorías
- **AND** ninguna pantalla vuelve a ofrecerla mientras dure la sesión

#### Scenario: El `revalidatePath` de la server action no alcanza

- **WHEN** una mutación de catálogo se implementa como server action con `revalidatePath`
- **THEN** el llamador cliente igualmente invalida la query key del catálogo tras un resultado exitoso
- **AND** una mutación que solo hace `revalidatePath` no cumple este requirement

#### Scenario: Cada plataforma invalida su propia key

- **WHEN** la misma mutación de catálogo existe en web y en mobile sobre query keys distintas
- **THEN** cada plataforma invalida la key con la que cachea ese catálogo
- **AND** ninguna queda sirviendo el catálogo viejo porque la otra sí invalidó
