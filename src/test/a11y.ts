import axe from 'axe-core'
import { expect } from 'vitest'

// axe probes canvas support for colour checks; jsdom has none and logs noise.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext

/**
 * Fails with a readable list if the rendered DOM has accessibility problems.
 * Colour contrast needs real layout and colours, so it is checked in a real browser, not jsdom.
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  const summary = results.violations.map(
    (v) =>
      `${v.id}: ${v.help} (${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')})`,
  )
  expect(summary, summary.join('\n')).toEqual([])
}
