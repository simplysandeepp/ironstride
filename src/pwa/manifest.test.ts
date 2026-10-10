import { describe, expect, it } from 'vitest'
import { MANIFEST } from './manifest.ts'

// Lists the icon files that really exist in public/icons (resolved by Vite at test time).
const ICON_FILES = Object.keys(import.meta.glob('../../public/icons/*.png'))

describe('web app manifest', () => {
  it('describes an installable standalone portrait app', () => {
    expect(MANIFEST).toMatchObject({
      name: 'IronStride',
      short_name: 'IronStride',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
    })
  })

  it('matches the dark theme colours', () => {
    expect(MANIFEST.theme_color).toBe('#0c0e11')
    expect(MANIFEST.background_color).toBe('#0c0e11')
  })

  it('has 192, 512 and maskable icons that exist on disk', () => {
    const sizes = MANIFEST.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(MANIFEST.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of MANIFEST.icons) {
      expect(
        ICON_FILES.some((f) => f.endsWith(icon.src.replace('/icons/', '/icons/'))),
        icon.src,
      ).toBe(true)
    }
  })
})
