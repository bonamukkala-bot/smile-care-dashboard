import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BrandMark from './BrandMark'
import LoginArt from './LoginArt'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

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
    <div className="login-page">
      {/* Background Dotted Radial Grid */}
      <div className="login-grid-bg" aria-hidden="true" />

      {/* ====================================================================
          LEFT BRAND PANEL (~45% width, 100vh)
          ==================================================================== */}
      <section className="login-brand-panel" aria-label="Smile Care Clinic Branding">
        {/* Soft Radial Ambient Glow */}
        <div className="login-panel-glow" aria-hidden="true" />

        {/* Top-Left Brand Logo & Clinic Name */}
        <header className="login-brand-top">
          <BrandMark size={74} className="login-top-logo" />
          <div className="login-brand-top-text">
            <span className="login-brand-name">Smile Care</span>
            <span className="login-brand-dept">DENTAL CLINIC</span>
          </div>
        </header>

        {/* Center Content: 3-line Headline, Subline, and Artwork */}
        <div className="login-brand-center">
          <div className="login-headline-wrap">
            <h1 className="login-hero-headline">
              <span>Care that</span>
              <span>starts with</span>
              <span>
                a <span className="login-smile-serif">smile.</span>
              </span>
            </h1>
            <p className="login-hero-subline">
              <span>Secure access for your</span>
              <span>clinic team.</span>
            </p>
          </div>

          <div className="login-art-container">
            <LoginArt />
          </div>
        </div>

        {/* Bottom-Left: Cyan accent line & Clinic Staff Portal label */}
        <footer className="login-brand-bottom-left">
          <span className="login-cyan-line" aria-hidden="true" />
          <span className="login-clinic-meta">
            SMILE CARE DENTAL CLINIC · STAFF PORTAL
          </span>
        </footer>

        {/* Bottom-Right within panel: 4 stacked uppercase words */}
        <div className="login-brand-bottom-right" aria-hidden="true">
          <span>HEALTHIER</span>
          <span>BRIGHTER</span>
          <span>HAPPIER</span>
          <span>TOGETHER</span>
        </div>
      </section>

      {/* ====================================================================
          RIGHT LOGIN PANEL (~55% width)
          ==================================================================== */}
      <main className="login-form-panel">
        {/* Mobile & Tablet Compact Header (< 1024px) */}
        <header className="login-mobile-header">
          <BrandMark size={48} />
          <div className="login-mobile-header-text">
            <span className="login-mobile-brand-name">Smile Care</span>
            <span className="login-mobile-brand-dept">DENTAL CLINIC</span>
          </div>
          <p className="login-mobile-tagline">Secure access for your clinic team.</p>
        </header>

        {/* Glass Card */}
        <div className="login-card">
          <div className="login-card-header">
            <span className="login-badge-label">STAFF PORTAL</span>
            <h2 className="login-card-title">Welcome back</h2>
            <p className="login-card-subline">Sign in to manage your clinic.</p>
          </div>

          {error && (
            <div className="login-alert-box" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form-body" noValidate>
            {/* Field 1: Work Email */}
            <div className="login-field-group">
              <label htmlFor="email" className="login-field-label">
                Work email
              </label>
              <div className="login-input-wrapper">
                <Mail className="login-input-icon" size={20} aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="staff@smilecare.com"
                  disabled={loading}
                  className="login-input"
                />
              </div>
            </div>

            {/* Field 2: Password */}
            <div className="login-field-group">
              <label htmlFor="password" className="login-field-label">
                Password
              </label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" size={20} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  disabled={loading}
                  className="login-input login-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="login-password-toggle-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot password row */}
            <div className="login-forgot-row">
              <button
                type="button"
                onClick={() => setForgotPasswordOpen((prev) => !prev)}
                className="login-forgot-link-btn"
              >
                Forgot password?
              </button>
            </div>

            {forgotPasswordOpen && (
              <div className="login-forgot-note" aria-live="polite">
                Please ask your clinic admin to reset your password.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="login-submit-button"
            >
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Card Footer */}
          <footer className="login-card-footer">
            <div className="login-security-badge">
              <Lock size={15} aria-hidden="true" />
              <span>Your account is protected with secure encryption.</span>
            </div>

            <hr className="login-card-divider" />

            <div className="login-help-row">
              <span>Need help? </span>
              <span className="login-admin-text">Contact clinic admin</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
