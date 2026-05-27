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
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
