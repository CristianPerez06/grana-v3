import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

const nextConfig: NextConfig = {
  transpilePackages: [
    '@grana/i18n-messages',
    '@grana/supabase',
    '@grana/validation',
  ],
}

export default withNextIntl(nextConfig)
