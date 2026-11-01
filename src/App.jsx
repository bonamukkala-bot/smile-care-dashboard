import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Home from './components/Home'
import CallLog from './components/CallLog'
import CallDetail from './components/CallDetail'
import NeedsAttention from './components/NeedsAttention'
import TodayBookings from './components/TodayBookings'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isStaffProfileMissing, setIsStaffProfileMissing] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const activeUserIdRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function loadStaffProfile(userId) {
      setLoading(true)
      setIsStaffProfileMissing(false)

      try {
        const { data, error } = await supabase
          .from('staff_profiles')
          .select('user_id, full_name, role')
          .eq('user_id', userId)
          .maybeSingle()

        if (!isMounted) return

        if (error) {
          console.error('Error fetching staff profile:', error.message)
          setProfile(null)
          setIsStaffProfileMissing(true)
        } else if (!data) {
          setProfile(null)
          setIsStaffProfileMissing(true)
        } else {
          setProfile(data)
          setIsStaffProfileMissing(false)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Unexpected error loading staff profile:', err)
        setProfile(null)
        setIsStaffProfileMissing(true)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Initial session retrieval
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return
      setSession(currentSession)

      if (currentSession?.user?.id) {
        activeUserIdRef.current = currentSession.user.id
        loadStaffProfile(currentSession.user.id)
      } else {
        setProfile(null)
        setIsStaffProfileMissing(false)
        setLoading(false)
      }
    })

    // Listen for auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)

      if (!currentSession) {
        activeUserIdRef.current = null
        setProfile(null)
        setIsStaffProfileMissing(false)
        setLoading(false)
      } else if (currentSession.user.id !== activeUserIdRef.current) {
        activeUserIdRef.current = currentSession.user.id
        loadStaffProfile(currentSession.user.id)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleUnauthorizedLogout = async () => {
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

  if (loading) {
    return (
      <main className="center-container">
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Loading Smile Care Dashboard...</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return <Login />
  }

  if (isStaffProfileMissing) {
    return (
      <main className="center-container">
        <div className="card status-card">
          <p className="status-message">
            Your account is not set up as staff. Please contact the admin.
          </p>
          <button
            type="button"
            onClick={handleUnauthorizedLogout}
            disabled={loggingOut}
            className="btn btn-logout"
          >
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Home profile={profile} />} />
      <Route path="/calls" element={<CallLog />} />
      <Route
        path="/calls/:callId"
        element={<CallDetail currentUserId={session?.user?.id} />}
      />
      <Route
        path="/attention"
        element={<NeedsAttention currentUserId={session?.user?.id} />}
      />
      <Route path="/bookings" element={<TodayBookings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
