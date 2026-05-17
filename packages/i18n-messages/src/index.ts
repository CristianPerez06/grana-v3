import es from './es.json'
import en from './en.json'

export { es, en }

export type Messages = typeof es
export const messages = { es, en } as const
