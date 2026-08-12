import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupPage } from './SignupPage'

const signup = vi.fn()

vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ signup }),
}))

describe('SignupPage', () => {
  beforeEach(() => signup.mockReset())

  it('does not ask the browser to choose an account role', () => {
    render(<MemoryRouter><SignupPage /></MemoryRouter>)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/terms')
  })

  it('rejects mismatched passwords before calling the API', async () => {
    render(<MemoryRouter><SignupPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Owner' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm'), { target: { value: 'password2' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.'))
    expect(signup).not.toHaveBeenCalled()
  })
})
