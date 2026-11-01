import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const form = e.currentTarget
    const formData = new FormData(form)
    const email = formData.get('email')?.toString().trim()
    const password = formData.get('password')?.toString()

    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        const message = signInError.message.toLowerCase()
        if (
          message.includes('invalid login credentials') ||
          message.includes('invalid grant') ||
          message.includes('invalid email or password')
        ) {
          setError('Wrong email or password.')
        } else {
          setError(signInError.message || 'Unable to log in. Please try again.')
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="center-container">
      <div className="card login-card">
        <header className="login-card-header">
          <h1 className="clinic-title">Smile Care Dental Clinic</h1>
          <p className="card-subtitle">Staff Dashboard Login</p>
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="staff@smilecare.com"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </main>
  )
}

