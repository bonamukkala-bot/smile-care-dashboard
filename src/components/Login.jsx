import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BrandMark from './BrandMark'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
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
    <div className="login-page-root">
      {/* Left Brand Panel (Desktop) */}
      <div className="login-brand-panel">
        <div className="login-brand-glow" aria-hidden="true" />
        <div className="login-brand-content">
          <div className="login-brand-header">
            <BrandMark size={44} />
            <div className="brand-text-block">
              <span className="brand-title">Smile Care</span>
              <span className="brand-subtitle">Dental Clinic</span>
            </div>
          </div>

          {/* Artistic Clean Outlined Tooth SVG */}
          <div className="login-hero-artwork" aria-hidden="true">
            <svg
              width="180"
              height="180"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="login-tooth-svg"
            >
              <defs>
                <linearGradient id="toothGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7C5CFF" />
                  <stop offset="50%" stopColor="#2A6BFF" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
                <radialGradient id="toothGlow" cx="50%" cy="40%" r="50%">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="42" fill="url(#toothGlow)" />
              {/* Modern Glassy Tooth Path */}
              <path
                d="M50 20C36 20 28 27.5 28 38.5C28 48.5 33 59 38 71C40 75.8 44.5 77 48 74.5L50 73L52 74.5C55.5 77 60 75.8 62 71C67 59 72 48.5 72 38.5C72 27.5 64 20 50 20Z"
                fill="url(#toothGrad)"
                fillOpacity="0.12"
                stroke="url(#toothGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Inner smile arc */}
              <path
                d="M39 42C43 47 57 47 61 42"
                stroke="#22D3EE"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="login-headline-group">
            <h1 className="login-headline">
              Care that starts with a <span className="accent-serif-word">smile.</span>
            </h1>
            <p className="login-subline">Secure access for your clinic team.</p>
          </div>
        </div>
      </div>

      {/* Right Login Card Panel */}
      <div className="login-form-panel">
        <div className="login-card-container">
          {/* Mobile brand header */}
          <div className="login-mobile-brand">
            <BrandMark size={36} />
            <div>
              <span className="brand-title">Smile Care</span>
              <span className="brand-subtitle">Dental Clinic</span>
            </div>
          </div>

          <div className="login-card-header">
            <span className="portal-label">STAFF PORTAL</span>
            <h2 className="login-title">Welcome back</h2>
            <p className="login-desc">Sign in to manage your clinic.</p>
          </div>

          {error && (
            <div className="alert alert-error login-alert" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="staff@smilecare.com"
                disabled={loading}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="password-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  disabled={loading}
                  className="form-input password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="btn-toggle-password"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-signin-submit"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="login-footer-meta">
            <div className="security-notice">
              <Lock size={14} className="security-lock-icon" />
              <span>Your account is protected with secure encryption.</span>
            </div>
            <p className="login-help-text">
              Need help? Contact your clinic admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
