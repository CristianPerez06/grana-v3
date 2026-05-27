# @grana/i18n-messages

Catálogos de mensajes (JSON) compartidos por web y mobile, más los formateadores de moneda. Sin runtime de i18n propio: cada app conecta estos catálogos a su propia librería (next-intl en web, helper RN en mobile).

## Por qué este package existe

El copy de usuario tiene que ser idéntico en ambas plataformas. Manteniendo un solo par de catálogos (`es.json`, `en.json`), un texto nuevo aparece una vez y las dos apps lo consumen. El tipo `Messages` (derivado de `es.json`) le da a TypeScript la forma del catálogo, así una key faltante rompe el build.

## Qué exporta

| Export | Qué es |
|---|---|
| `es`, `en` | Los catálogos como objetos. También accesibles como sub-paths: `@grana/i18n-messages/es.json`, `/en.json`. |
| `messages` | `{ es, en }` — el mapa completo de locales. |
| `Messages` | Tipo derivado de `es.json` (forma canónica del catálogo). |
| `formatARS(amount, showCents?)` | Formatea pesos con `Intl.NumberFormat('es-AR')`. Sin centavos por defecto. |
| `formatUSD(amount, showCents?)` | Formatea dólares. Con centavos por defecto. |

## Reglas

- **Sin runtime de i18n.** El package solo provee datos (JSON) y formatters puros. La resolución de locale, el provider y los placeholders los maneja cada app.
- **`es.json` es la forma canónica.** `en.json` debe tener las mismas keys; el tipo `Messages` sale de `es`.
- **Único lugar del repo donde los strings van en español** (es copy de usuario, no código). Ver "Language conventions" en `CLAUDE.md`.

## Cómo se consume

```ts
import { messages, formatARS } from '@grana/i18n-messages'
// web: <NextIntlClientProvider messages={messages[locale]} />
```
