import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ValidationLocaleSetter } from '@/lib/validation/setup-yup-locale'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'grana',
  description: 'Personal finances, made simple.',
}

/**
 * `viewportFit: 'cover'` is what makes `env(safe-area-inset-*)` resolve to
 * anything other than `0px`. Without it the chrome anchored to the viewport
 * edges — the navy PageHeader on top, the tab bar at the bottom — renders
 * under the notch and the home indicator once the PWA runs standalone.
 * The safe-area tokens in `@grana/ui-tokens` read those variables, so this
 * export is a prerequisite for all of them.
 *
 * `themeColor` is the `<meta name="theme-color">` tag, which tints the
 * browser UI. It is deliberately the same navy as the manifest's
 * `theme_color` (see `manifest.ts`): the manifest paints the system bars of
 * the installed app, this one paints the browser's own chrome.
 */
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#0B1A2B',
}

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ValidationLocaleSetter />
          <div className="flex flex-col flex-1 min-h-0">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export default RootLayout
