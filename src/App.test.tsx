import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('shows the five primary destinations', () => {
    renderApp()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    for (const label of ['Today', 'Gym', 'Run', 'Nutrition', 'Progress']) {
      expect(nav).toHaveTextContent(label)
    }
  })

  it('navigates between screens and marks the current one', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('link', { name: 'Gym' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Gym' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gym' })).toHaveAttribute('aria-current', 'page')
  })

  it('defaults to dark and persists a theme change', async () => {
    renderApp()
    expect(document.documentElement.dataset.theme).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: /theme: dark/i }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('ironstride.theme')).toBe('light')
  })
})
