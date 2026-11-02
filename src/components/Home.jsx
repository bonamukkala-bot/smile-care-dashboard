import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  Calendar,
  PhoneCall,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Phone,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  getISTDateRange,
  getISTDateKey,
  getISTWeekDays,
  formatISTTimeShort,
  formatSlotRange,
  maskPhone,
  getPatientNumber,
  formatTimeAgo,
  getOutcome,
  formatAppointmentStatus,
  getAppointmentStatusColor,
  formatAttentionType,
  getISTLongDate,
} from '../lib/helpers'
import NewBookingModal from './NewBookingModal'
import ClosureNotice from './ClosureNotice'

export default function Home({ profile }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showNewBooking, setShowNewBooking] = useState(false)

  // Data states
  const [urgentItem, setUrgentItem] = useState(null)
  const [openAttentionCount, setOpenAttentionCount] = useState(0)
  const [hasEmergency, setHasEmergency] = useState(false)
  const [todayAppointments, setTodayAppointments] = useState([])
  const [callsTodayCount, setCallsTodayCount] = useState(0)
  const [recentCalls, setRecentCalls] = useState([])
  const [weekCounts, setWeekCounts] = useState({}) // { '2026-10-26': 2, ... }
  const [nextSlotText, setNextSlotText] = useState('No appointments yet')

  const todayIST = getTodayIST()
  const weekDays = useMemo(() => getISTWeekDays(todayIST), [todayIST])

  // Compute greeting in IST
  const greetingText = useMemo(() => {
    try {
      const hourIST = parseInt(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          hour12: false,
        }).format(new Date()),
        10
      )
      if (hourIST < 12) return 'Good morning'
      if (hourIST < 17) return 'Good afternoon'
      return 'Good evening'
    } catch {
      return 'Welcome'
    }
  }, [])

  const firstName = (profile?.full_name || 'Staff').trim().split(' ')[0] || 'Staff'
  const longDateIST = getISTLongDate()

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        const { startUTC: todayStart, endUTC: todayEnd } = getISTDateRange(todayIST)

        // Week date range (Mon to Sun)
        const weekStart = weekDays[0] ? getISTDateRange(weekDays[0]).startUTC : todayStart
        const weekEnd = weekDays[6] ? getISTDateRange(weekDays[6]).endUTC : todayEnd

        const [
          openCountRes,
          emergencyCountRes,
          urgentItemRes,
          todayApptsRes,
          callsTodayRes,
          recentCallsRes,
          weekApptsRes,
        ] = await Promise.all([
          // 1. Attention count
          supabase
            .from('attention_items')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open'),

          // 2. Emergency attention count
          supabase
            .from('attention_items')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open')
            .eq('type', 'emergency'),

          // 3. Most urgent open attention item
          supabase
            .from('attention_items')
            .select('id, call_id, type, status, note, created_at, calls(patient_number, from_number)')
            .eq('status', 'open')
            .order('type', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

          // 4. Today's non-cancelled appointments
          supabase
            .from('appointments')
            .select('id, slot_start, patient_name, patient_phone, reason, status, source')
            .gte('slot_start', todayStart)
            .lte('slot_start', todayEnd)
            .neq('status', 'cancelled')
            .order('slot_start', { ascending: true }),

          // 5. Calls today count
          supabase
            .from('calls')
            .select('call_id', { count: 'exact', head: true })
            .gte('started_at', todayStart)
            .lte('started_at', todayEnd),

          // 6. Recent 4 calls
          supabase
            .from('calls')
            .select(
              'call_id, direction, from_number, to_number, patient_number, started_at, status, hangup_source, variables'
            )
            .order('started_at', { ascending: false })
            .limit(4),

          // 7. Appointments this week for chart & stat
          supabase
            .from('appointments')
            .select('id, slot_start')
            .gte('slot_start', weekStart)
            .lte('slot_start', weekEnd)
            .neq('status', 'cancelled'),
        ])

        if (!isMounted) return

        // Open Attention Counts
        if (!openCountRes.error) {
          setOpenAttentionCount(openCountRes.count ?? 0)
        }
        if (!emergencyCountRes.error) {
          setHasEmergency((emergencyCountRes.count ?? 0) > 0)
        }

        // Most urgent item
        if (!urgentItemRes.error) {
          setUrgentItem(urgentItemRes.data || null)
        }

        // Today's appointments
        if (!todayApptsRes.error) {
          const appts = todayApptsRes.data || []
          setTodayAppointments(appts)

          const nowMs = Date.now()
          const upcoming = appts.find((a) => new Date(a.slot_start).getTime() > nowMs)
          if (upcoming) {
            setNextSlotText(`Next: ${formatISTTimeShort(upcoming.slot_start)}`)
          } else if (appts.length > 0) {
            setNextSlotText('All appointments completed')
          } else {
            setNextSlotText('No appointments yet')
          }
        }

        // Calls count today
        if (!callsTodayRes.error) {
          setCallsTodayCount(callsTodayRes.count ?? 0)
        }

        // Recent calls
        if (!recentCallsRes.error) {
          setRecentCalls(recentCallsRes.data || [])
        }

        // Aggregate week counts by day
        if (!weekApptsRes.error && weekApptsRes.data) {
          const countsMap = {}
          for (const day of weekDays) {
            countsMap[day] = 0
          }
          for (const appt of weekApptsRes.data) {
            const dayKey = getISTDateKey(appt.slot_start)
            if (countsMap[dayKey] !== undefined) {
              countsMap[dayKey] += 1
            }
          }
          setWeekCounts(countsMap)
        }

        setError(null)
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load dashboard data:', err)
        setError('Unable to load dashboard data. Please try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    // 60-second auto-refresh
    const interval = setInterval(() => {
      if (isMounted) {
        loadDashboard()
      }
    }, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [todayIST, weekDays, reloadKey])

  // Compute stat card figures
  const todayBookingsCount = todayAppointments.length

  // Count Mon-Sat this week
  const thisWeekCount = useMemo(() => {
    let sum = 0
    // weekDays has 7 items: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    for (let i = 0; i < 6; i++) {
      const day = weekDays[i]
      if (day && weekCounts[day]) {
        sum += weekCounts[day]
      }
    }
    return sum
  }, [weekDays, weekCounts])

  // Max count for chart scaling
  const maxDayCount = useMemo(() => {
    let max = 1
    for (const d of weekDays) {
      if (weekCounts[d] && weekCounts[d] > max) {
        max = weekCounts[d]
      }
    }
    return max
  }, [weekDays, weekCounts])

  return (
    <div className="home-dashboard">
      {/* a) Greeting & Actions Header */}
      <section className="dashboard-hero-section">
        <div className="hero-greeting-block">
          <h1 className="hero-greeting-title">
            {greetingText}, <span className="accent-serif-word">{firstName}</span>
          </h1>
          <p className="hero-date-subline">{longDateIST}</p>
        </div>

        <div className="hero-actions-row">
          <button
            type="button"
            onClick={() => setShowNewBooking(true)}
            className="btn btn-primary btn-hero-primary"
          >
            <Plus size={18} />
            <span>+ New booking</span>
          </button>
          <Link to="/appointments" className="btn btn-secondary btn-hero-secondary">
            <span>View appointments</span>
          </Link>
        </div>
      </section>

      {/* Error alert if fetch failed */}
      {error && !loading && (
        <div className="alert alert-error mb-24" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="btn btn-secondary btn-sm ml-auto"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="dashboard-skeleton-wrap" aria-busy="true" aria-label="Loading dashboard">
          <div className="skeleton-card skeleton-banner" />
          <div className="skeleton-grid-3">
            <div className="skeleton-card skeleton-stat" />
            <div className="skeleton-card skeleton-stat" />
            <div className="skeleton-card skeleton-stat" />
          </div>
          <div className="skeleton-grid-2">
            <div className="skeleton-card skeleton-col" />
            <div className="skeleton-card skeleton-col" />
          </div>
          <div className="skeleton-card skeleton-chart" />
        </div>
      ) : (
        <>
          {/* Subtle Closure Notice: If Needs Attention is empty, placed ABOVE Needs Attention banner */}
          {openAttentionCount === 0 && (
            <ClosureNotice dateStr={todayIST} isHome={true} />
          )}

          {/* b) Needs Attention Banner */}
          {openAttentionCount > 0 ? (
            <section
              className={`attention-hero-banner ${
                hasEmergency ? 'banner-danger' : 'banner-warning'
              }`}
              role="alert"
            >
              <div className="banner-icon-col">
                <AlertTriangle size={24} className="banner-alert-icon" />
              </div>
              <div className="banner-content-col">
                <div className="banner-badge-row">
                  <span className="banner-tag">
                    {hasEmergency ? 'EMERGENCY' : 'NEEDS ATTENTION'}
                  </span>
                  <span className="banner-count-badge">
                    {openAttentionCount} {openAttentionCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {urgentItem ? (
                  <p className="banner-detail-text">
                    <strong>{formatAttentionType(urgentItem.type)}</strong>
                    {urgentItem.calls?.patient_number || urgentItem.calls?.from_number ? (
                      <> • {maskPhone(urgentItem.calls.patient_number || urgentItem.calls.from_number)}</>
                    ) : null}
                    {urgentItem.created_at ? (
                      <> • {formatTimeAgo(urgentItem.created_at)}</>
                    ) : null}
                  </p>
                ) : (
                  <p className="banner-detail-text">
                    {openAttentionCount} call issue(s) require review.
                  </p>
                )}
              </div>
              <div className="banner-action-col">
                <Link to="/attention" className="btn btn-primary btn-banner-review">
                  <span>Review</span>
                  <ArrowRight size={17} />
                </Link>
              </div>
            </section>
          ) : (
            <section className="attention-hero-banner banner-success" role="status">
              <div className="banner-icon-col">
                <CheckCircle2 size={24} className="banner-check-icon" />
              </div>
              <div className="banner-content-col">
                <span className="banner-success-title">All clear, nothing needs attention</span>
                <p className="banner-success-desc">
                  No emergency or pending attention items at this time.
                </p>
              </div>
              <div className="banner-action-col">
                <Link to="/attention" className="btn btn-secondary btn-sm">
                  View resolved
                </Link>
              </div>
            </section>
          )}

          {/* Subtle Closure Notice: If Needs Attention has items, placed right UNDER Needs Attention banner */}
          {openAttentionCount > 0 && (
            <ClosureNotice dateStr={todayIST} isHome={true} />
          )}

          {/* c) Three Stat Cards (Clickable) */}
          <section className="stat-cards-grid" aria-label="Key Clinic Metrics">
            {/* Card 1: Today's Bookings */}
            <Link to="/bookings" className="card stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-tile stat-icon-teal">
                  <CalendarCheck size={22} />
                </div>
                <ChevronRight size={18} className="stat-card-arrow" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number">{todayBookingsCount}</span>
                <span className="stat-card-label">Today's bookings</span>
                <span className="stat-card-subtext">{nextSlotText}</span>
              </div>
            </Link>

            {/* Card 2: Calls Today */}
            <Link to="/calls" className="card stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-tile stat-icon-blue">
                  <PhoneCall size={22} />
                </div>
                <ChevronRight size={18} className="stat-card-arrow" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number">{callsTodayCount}</span>
                <span className="stat-card-label">Calls today</span>
                <span className="stat-card-subtext">Total calls received</span>
              </div>
            </Link>

            {/* Card 3: This Week */}
            <Link to="/appointments" className="card stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-tile stat-icon-indigo">
                  <Calendar size={22} />
                </div>
                <ChevronRight size={18} className="stat-card-arrow" />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-number">{thisWeekCount}</span>
                <span className="stat-card-label">This week</span>
                <span className="stat-card-subtext">Mon–Sat scheduled bookings</span>
              </div>
            </Link>
          </section>

          {/* d) Two-Column Area: Today's Appointments & Recent Calls */}
          <section className="dashboard-twocol-grid">
            {/* Column 1: Today's Appointments */}
            <div className="card twocol-card">
              <div className="twocol-header">
                <div>
                  <h2 className="twocol-title">Today's appointments</h2>
                  <span className="twocol-subtitle">
                    {todayAppointments.length} scheduled for today
                  </span>
                </div>
                <Link to="/bookings" className="btn-link-action">
                  View all →
                </Link>
              </div>

              {todayAppointments.length === 0 ? (
                <div className="dashboard-empty-box">
                  <Calendar size={32} className="empty-icon" />
                  <p className="empty-primary-text">No appointments scheduled today</p>
                  <button
                    type="button"
                    onClick={() => setShowNewBooking(true)}
                    className="btn btn-secondary btn-sm mt-8"
                  >
                    + New booking
                  </button>
                </div>
              ) : (
                <div className="dashboard-list">
                  {todayAppointments.map((appt) => {
                    const statusColor = getAppointmentStatusColor(appt.status)
                    const statusLabel = formatAppointmentStatus(appt.status)
                    const timeRange = formatSlotRange(appt.slot_start)
                    const sourceLabel = appt.source === 'ai' ? 'AI' : 'Staff'

                    return (
                      <Link
                        key={appt.id}
                        to={`/appointments/${appt.id}`}
                        className="dashboard-list-item"
                      >
                        <div className="item-time-col">
                          <span className="item-time-text">{timeRange}</span>
                          <span className="source-tag">{sourceLabel}</span>
                        </div>

                        <div className="item-main-col">
                          <span className="item-patient-name">
                            {appt.patient_name || 'Patient'}
                          </span>
                          {appt.reason && (
                            <span className="item-sub-desc">{appt.reason}</span>
                          )}
                        </div>

                        <div className="item-badge-col">
                          <span className={`badge status-badge status-badge-${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Recent Calls */}
            <div className="card twocol-card">
              <div className="twocol-header">
                <div>
                  <h2 className="twocol-title">Recent calls</h2>
                  <span className="twocol-subtitle">Latest phone interactions</span>
                </div>
                <Link to="/calls" className="btn-link-action">
                  View call log →
                </Link>
              </div>

              {recentCalls.length === 0 ? (
                <div className="dashboard-empty-box">
                  <Phone size={32} className="empty-icon" />
                  <p className="empty-primary-text">No calls recorded yet</p>
                </div>
              ) : (
                <div className="dashboard-list">
                  {recentCalls.map((call) => {
                    const phoneFormatted = maskPhone(getPatientNumber(call))
                    const timeAgo = formatTimeAgo(call.started_at)
                    const outcome = getOutcome(call, null, [])

                    return (
                      <Link
                        key={call.call_id}
                        to={`/calls/${call.call_id}`}
                        className="dashboard-list-item"
                      >
                        <div className="item-call-icon-wrap">
                          <PhoneCall size={18} />
                        </div>

                        <div className="item-main-col">
                          <span className="item-patient-name">{phoneFormatted}</span>
                          <span className="item-sub-desc">{timeAgo}</span>
                        </div>

                        <div className="item-badge-col">
                          <span
                            className={`badge status-badge status-badge-${outcome.color}`}
                          >
                            {outcome.label}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* e) "Bookings this week" CSS Bar Chart */}
          <section className="card chart-section-card" aria-label="Bookings this week chart">
            <div className="chart-header">
              <div>
                <h2 className="twocol-title">Bookings this week</h2>
                <span className="twocol-subtitle">
                  Mon–Sat counts for the current week in IST
                </span>
              </div>
              <span className="chart-week-total-pill">
                {thisWeekCount} bookings
              </span>
            </div>

            <div className="bar-chart-container" role="region" aria-label="Appointments bar chart">
              <div className="bar-chart-grid">
                {weekDays.map((dateKey, index) => {
                  const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
                  const isSun = index === 6
                  const isToday = dateKey === todayIST
                  const count = weekCounts[dateKey] || 0
                  const heightPercent = Math.max(8, Math.round((count / maxDayCount) * 100))

                  return (
                    <div
                      key={dateKey}
                      className={`bar-col ${isToday ? 'bar-col-today' : ''} ${
                        isSun ? 'bar-col-sunday' : ''
                      }`}
                      aria-label={`${dayName} (${dateKey}): ${count} appointments ${
                        isToday ? '(Today)' : ''
                      } ${isSun ? '(Closed)' : ''}`}
                    >
                      <span className="bar-count-number">{count}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="bar-day-label">
                        {dayName}
                        {isToday && <span className="today-dot-indicator" />}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {/* New Booking Modal */}
      {showNewBooking && (
        <NewBookingModal
          isOpen={showNewBooking}
          onClose={() => setShowNewBooking(false)}
          onSuccess={() => {
            setReloadKey((prev) => prev + 1)
          }}
          initialDate={todayIST}
        />
      )}
    </div>
  )
}
