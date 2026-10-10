/** Web app manifest for the installed app. Colours match the dark theme tokens. */
export const MANIFEST = {
  name: 'IronStride',
  short_name: 'IronStride',
  description: 'Private hybrid athlete training log: gym, running and vegan nutrition.',
  start_url: '/',
  scope: '/',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  theme_color: '#0c0e11',
  background_color: '#0c0e11',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
