import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatIST, formatTimeAgo } from '../lib/helpers'

export default function HealthStrip() {
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [dbConnected, setDbConnected] = useState(true)
  const [lastCallText, setLastCallText] = useState('')
  const [openCount, setOpenCount] = useState(0)
  const [hasEmergency, setHasEmergency] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkSystemHealth() {
      try {
        const [healthRes, lastCallRes, openAttnRes, emergencyAttnRes] =
          await Promise.all([
            // a) Lightweight query to check database reachability
            supabase
              .from('calls')
              .select('call_id', { count: 'exact', head: true })
              .limit(1),

            // b) Newest calls.received_at
            supabase
              .from('calls')
              .select('received_at')
              .order('received_at', { ascending: false })
              .limit(1)
              .maybeSingle(),

            // c) Count of attention_items with status 'open'
            supabase
              .from('attention_items')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'open'),

            // c) Emergency attention items check
            supabase
              .from('attention_items')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'open')
              .eq('type', 'emergency'),
          ])

        if (!isMounted) return

        // 1. Database status
        setDbConnected(!healthRes.error)

        // 2. Last call received
        if (lastCallRes.error || !lastCallRes.data?.received_at) {
          setLastCallText('No calls yet')
        } else {
          const raw = lastCallRes.data.received_at
          const timeAgo = formatTimeAgo(raw)
          const istTime = formatIST(raw)
          setLastCallText(`${timeAgo} (${istTime})`)
        }

        // 3. Needs attention count & emergency flag
        if (!openAttnRes.error) {
          setOpenCount(openAttnRes.count ?? 0)
        }
        if (!emergencyAttnRes.error) {
          setHasEmergency((emergencyAttnRes.count ?? 0) > 0)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('System health check error:', err.message || err)
        setDbConnected(false)
      } finally {
        if (isMounted) {
          setIsFirstLoad(false)
        }
      }
    }

    checkSystemHealth()

    // Refresh automatically every 60 seconds; stops when unmounted
    const interval = setInterval(() => {
      if (isMounted) {
        checkSystemHealth()
      }
    }, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Determine color for Needs Attention item:
  // Red if any open item has type 'emergency', amber if N > 0, green if 0
  let attentionColorClass = 'health-indicator-green'
  if (hasEmergency) {
    attentionColorClass = 'health-indicator-red'
  } else if (openCount > 0) {
    attentionColorClass = 'health-indicator-amber'
  }

  return (
    <aside className="health-strip-container" aria-label="System Health">
      <div className="health-strip-inner">
        <div className="health-items-row">
          {/* Item A: Dashboard Connection */}
          <div className="health-item">
            {isFirstLoad ? (
              <>
                <span className="health-dot health-indicator-checking" />
                <span className="health-label">Checking...</span>
              </>
            ) : dbConnected ? (
              <>
                <span className="health-dot health-indicator-green" />
                <span className="health-label">Dashboard connected</span>
              </>
            ) : (
              <>
                <span className="health-dot health-indicator-red" />
                <span className="health-label health-error-label">
                  Can't reach database
                </span>
              </>
            )}
          </div>

          <span className="health-divider" aria-hidden="true">
            •
          </span>

          {/* Item B: Last Call Received (Neutral color) */}
          <div className="health-item health-item-neutral">
            <span className="health-item-title">Last call received:</span>
            <span className="health-item-value">
              {isFirstLoad ? 'Checking...' : lastCallText || 'No calls yet'}
            </span>
          </div>

          <span className="health-divider" aria-hidden="true">
            •
          </span>

          {/* Item C: Needs Attention Count (Tapping goes to /attention) */}
          <Link
            to="/attention"
            className="health-item health-item-link"
            title="Go to Needs Attention"
          >
            <span
              className={`health-dot ${
                isFirstLoad ? 'health-indicator-checking' : attentionColorClass
              }`}
            />
            <span className="health-link-text">
              Needs attention: <strong>{isFirstLoad ? 'Checking...' : openCount}</strong>
            </span>
          </Link>
        </div>

        {/* Wide screens disclaimer */}
        <span className="health-strip-disclaimer">
          Shows what the dashboard can see. It cannot check the phone line.
        </span>
      </div>
    </aside>
  )
}
