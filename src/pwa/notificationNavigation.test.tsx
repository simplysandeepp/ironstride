import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isAppPath, useNotificationNavigation } from './notificationNavigation.ts'

function Probe() {
  useNotificationNavigation()
  return <p data-testid="where">{useLocation().pathname}</p>
}

const target = new EventTarget()
beforeEach(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: target, configurable: true })
})
afterEach(() =>
  Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true }),
)

const send = (data: unknown) =>
  act(() => {
    target.dispatchEvent(new MessageEvent('message', { data }))
  })

describe('useNotificationNavigation', () => {
  it('moves to the screen a tapped notification asked for', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Probe />
      </MemoryRouter>,
    )
    send({ type: 'open-path', path: '/gym' })
    expect(screen.getByTestId('where')).toHaveTextContent('/gym')
  })

  it('ignores other messages and addresses that leave the app', () => {
    render(
      <MemoryRouter initialEntries={['/run']}>
        <Probe />
      </MemoryRouter>,
    )
    send({ type: 'something-else', path: '/gym' })
    send({ type: 'open-path', path: 'https://example.com' })
    send({ type: 'open-path', path: '//example.com' })
    send(null)
    expect(screen.getByTestId('where')).toHaveTextContent('/run')
  })

  it('accepts only paths inside the app', () => {
    expect(isAppPath('/nutrition')).toBe(true)
    expect(isAppPath('//evil.test')).toBe(false)
    expect(isAppPath('https://evil.test')).toBe(false)
    expect(isAppPath(undefined)).toBe(false)
  })
})
