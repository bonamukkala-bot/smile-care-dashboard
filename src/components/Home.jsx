import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayIST, getISTDateRange } from '../lib/helpers'

export default function Home({ profile }) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const [hasEmergency, setHasEmergency] = useState(false)
  const [bookingsCount, setBookingsCount] = useState(0)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error.message)
      }
    } catch (err) {
      console.error('Unexpected error signing out:', err)
    } finally {
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function fetchCounts() {
      try {
        const todayIST = getTodayIST()
        const { startUTC, endUTC } = getISTDateRange(todayIST)

        const [openRes, emergencyRes, bookingsRes] = await Promise.all([
          supabase
            .from('attention_items')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open'),
          supabase
            .from('attention_items')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open')
            .eq('type', 'emergency'),
          supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .gte('slot_start', startUTC)
            .lte('slot_start', endUTC)
            .neq('status', 'cancelled'),
        ])

        if (!isMounted) return

        if (!openRes.error) {
          setOpenCount(openRes.count ?? 0)
        }
        if (!emergencyRes.error) {
          setHasEmergency((emergencyRes.count ?? 0) > 0)
        }
        if (!bookingsRes.error) {
          setBookingsCount(bookingsRes.count ?? 0)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Error fetching dashboard counts:', err.message || err)
      }
    }

    // Refresh every 60 seconds while Home is open and every time Home is shown again
    fetchCounts()

    const interval = setInterval(() => {
      if (isMounted) {
        fetchCounts()
      }
    }, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const fullName = profile?.full_name || 'Staff Member'
  const role = profile?.role || 'Staff'

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-info">
          <h1 className="clinic-title">Smile Care Dental Clinic</h1>
          <div className="user-greeting-wrapper">
            <span className="greeting-text">Hello, {fullName}</span>
            <span className="badge role-badge">{role}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-logout"
        >
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </header>

      <main className="dashboard-content">
        <section className="dashboard-actions-grid">
          {/* Big Needs Attention Button */}
          <Link
            to="/attention"
            className={`btn btn-nav-card ${
              hasEmergency ? 'btn-nav-emergency' : 'btn-nav-attention'
            }`}
          >
            <div className="btn-nav-label-group">
              <span className="btn-nav-main-text">Needs Attention</span>
              {hasEmergency && (
                <span className="emergency-badge-text">🚨 Emergency</span>
              )}
            </div>
            {openCount > 0 && (
              <span className="counter-badge" aria-label={`${openCount} open items`}>
                {openCount}
              </span>
            )}
          </Link>

          {/* Big Today's Bookings Button */}
          <Link
            to="/bookings"
            className="btn btn-nav-card btn-nav-bookings"
          >
            <span className="btn-nav-main-text">Today's Bookings</span>
            <span
              className="counter-badge counter-badge-teal"
              aria-label={`${bookingsCount} bookings today`}
            >
              {bookingsCount}
            </span>
          </Link>

          {/* Big Appointments Button (Day / Week / List views) */}
          <Link
            to="/appointments"
            className="btn btn-nav-card btn-nav-appointments"
          >
            <span className="btn-nav-main-text">Appointments</span>
            <span className="btn-nav-sub-arrow">Day, Week, List →</span>
          </Link>

          {/* Big Call Log Button */}
          <Link to="/calls" className="btn btn-primary btn-nav-card btn-nav-calls">
            <span className="btn-nav-main-text">Call Log</span>
          </Link>
        </section>
      </main>
    </div>
  )
}
