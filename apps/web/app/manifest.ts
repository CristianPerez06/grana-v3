import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Grana',
    short_name: 'Grana',
    description: 'Personal finances, made simple.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1A2B',
    theme_color: '#0B1A2B',
    icons: [
      // Opaque, full-bleed art: no alpha channel, no baked-in rounded corners.
      // iOS flattens transparency onto black, so a pre-rounded icon with clear
      // corners renders black wedges once the OS applies its own mask.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Same art as maskable: the glyph sits well inside the 80% safe zone, so
      // Android can crop to any launcher shape without clipping it.
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
