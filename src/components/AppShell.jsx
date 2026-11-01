import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertCircle,
  CalendarCheck,
  Calendar,
  PhoneCall,
} from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  getISTDateRange,
  formatIST,
  formatTimeAgo,
} from '../lib/helpers'

export default function AppShell({ profile, onLogout, loggingOut, children }) {
  const location = useLocation()

  // Live health and badge data
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [dbConnected, setDbConnected] = useState(true)
  const [lastCallRelative, setLastCallRelative] = useState('Checking...')
  const [lastCallFullIST, setLastCallFullIST] = useState('')
  const [openAttentionCount, setOpenAttentionCount] = useState(0)
  const [hasEmergency, setHasEmergency] = useState(false)
  const [todayBookingsCount, setTodayBookingsCount] = useState(0)

  // 60-second sync query for health and active badge counts
  useEffect(() => {
    let isMounted = true

    async function fetchSystemData() {
      try {
        const todayIST = getTodayIST()
        const { startUTC, endUTC } = getISTDateRange(todayIST)

        const [dbCheckRes, lastCallRes, openAttnRes, emergencyAttnRes, bookingsRes] =
          await Promise.all([
            // DB Reachability
            supabase
              .from('calls')
              .select('call_id', { count: 'exact', head: true })
              .limit(1),

            // Latest call
            supabase
              .from('calls')
              .select('received_at')
              .order('received_at', { ascending: false })
              .limit(1)
              .maybeSingle(),

            // Open attention items
            supabase
              .from('attention_items')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'open'),

            // Emergency attention items
            supabase
              .from('attention_items')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'open')
              .eq('type', 'emergency'),

            // Today's non-cancelled bookings
            supabase
              .from('appointments')
              .select('*', { count: 'exact', head: true })
              .gte('slot_start', startUTC)
              .lte('slot_start', endUTC)
              .neq('status', 'cancelled'),
          ])

        if (!isMounted) return

        // 1. Connection
        setDbConnected(!dbCheckRes.error)

        // 2. Last Call
        if (lastCallRes.error || !lastCallRes.data?.received_at) {
          setLastCallRelative('No calls yet')
          setLastCallFullIST('')
        } else {
          const raw = lastCallRes.data.received_at
          setLastCallRelative(formatTimeAgo(raw))
          setLastCallFullIST(formatIST(raw))
        }

        // 3. Needs Attention Count
        if (!openAttnRes.error) {
          setOpenAttentionCount(openAttnRes.count ?? 0)
        }
        if (!emergencyAttnRes.error) {
          setHasEmergency((emergencyAttnRes.count ?? 0) > 0)
        }

        // 4. Today's Bookings Count
        if (!bookingsRes.error) {
          setTodayBookingsCount(bookingsRes.count ?? 0)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('AppShell health query error:', err.message || err)
        setDbConnected(false)
      } finally {
        if (isMounted) {
          setIsFirstLoad(false)
        }
      }
    }

    fetchSystemData()

    const interval = setInterval(() => {
      if (isMounted) {
        fetchSystemData()
      }
    }, 60000)

    const handleAttentionChanged = () => {
      if (isMounted) {
        fetchSystemData()
      }
    }
    window.addEventListener('attention-changed', handleAttentionChanged)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('attention-changed', handleAttentionChanged)
    }
  }, [location.pathname])

  const healthData = {
    dbConnected,
    lastCallRelative,
    lastCallFullIST,
    openAttentionCount,
    hasEmergency,
    isFirstLoad,
  }

  return (
    <div className="app-layout-root">
      {/* Accessible skip link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop Fixed Left Sidebar */}
      <Sidebar
        openAttentionCount={openAttentionCount}
        hasEmergency={hasEmergency}
        todayBookingsCount={todayBookingsCount}
      />

      {/* Main Column (TopBar + Content + Mobile Bottom Tab Bar) */}
      <div className="app-main-wrapper">
        <TopBar
          profile={profile}
          onLogout={onLogout}
          loggingOut={loggingOut}
          healthData={healthData}
        />

        <main id="main-content" className="app-main-content" tabIndex="-1">
          <div className="content-inner-container" key={location.pathname}>
            {children}
          </div>
        </main>

        {/* Mobile / Tablet Fixed Bottom Tab Bar (< 1024px) */}
        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
          >
            <LayoutDashboard size={22} className="mobile-nav-icon" />
            <span className="mobile-nav-label">Dashboard</span>
          </NavLink>

          <NavLink
            to="/attention"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
          >
            <div className="mobile-icon-badge-wrap">
              <AlertCircle size={22} className="mobile-nav-icon" />
              {openAttentionCount > 0 && (
                <span
                  className={`mobile-nav-badge ${
                    hasEmergency ? 'badge-emergency' : 'badge-attention'
                  }`}
                >
                  {openAttentionCount}
                </span>
              )}
            </div>
            <span className="mobile-nav-label">Attention</span>
          </NavLink>

          <NavLink
            to="/bookings"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
          >
            <div className="mobile-icon-badge-wrap">
              <CalendarCheck size={22} className="mobile-nav-icon" />
              {todayBookingsCount > 0 && (
                <span className="mobile-nav-badge badge-bookings">
                  {todayBookingsCount}
                </span>
              )}
            </div>
            <span className="mobile-nav-label">Bookings</span>
          </NavLink>

          <NavLink
            to="/appointments"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
          >
            <Calendar size={22} className="mobile-nav-icon" />
            <span className="mobile-nav-label">Appts</span>
          </NavLink>

          <NavLink
            to="/calls"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
          >
            <PhoneCall size={22} className="mobile-nav-icon" />
            <span className="mobile-nav-label">Calls</span>
          </NavLink>
        </nav>
      </div>
    </div>
  )
}
