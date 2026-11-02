import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Info,
  CalendarOff,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatClosureReason,
  formatClosureWindow,
  formatClosureDateRange,
  getTodayIST,
  canCloseRestOfToday,
} from '../lib/helpers'
import ClosureTodayStatus from './ClosureTodayStatus'
import ClosureDayStrip from './ClosureDayStrip'
import ClosureCard from './ClosureCard'
import AddClosureDialog from './AddClosureDialog'
import Toast from './Toast'

export default function Closures() {
  const [closures, setClosures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Dialog & Toast states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [dialogInitialDate, setDialogInitialDate] = useState(null)
  const [dialogInitialType, setDialogInitialType] = useState(null)
  const [toast, setToast] = useState(null)
  const [autoExpandId, setAutoExpandId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)

  // How closures work help toggle
  const [showHelpPanel, setShowHelpPanel] = useState(false)

  // Attention banner state (total unhandled bookings across active closures)
  const [attentionData, setAttentionData] = useState({ count: 0, firstId: null })

  // Past closures state
  const [pastExpanded, setPastExpanded] = useState(false)
  const [pastClosures, setPastClosures] = useState([])
  const [loadingPast, setLoadingPast] = useState(false)
  const [pastLoaded, setPastLoaded] = useState(false)

  const todayIST = useMemo(() => getTodayIST(), [])
  const canQuickClose = useMemo(() => canCloseRestOfToday(), [])

  // Ref to hold closure card DOM nodes for scrolling
  const closureCardRefs = useRef({})

  // Load active and upcoming closures
  useEffect(() => {
    let isMounted = true

    async function fetchActiveClosures() {
      try {
        const nowISO = new Date().toISOString()

        const { data, error: fetchErr } = await supabase
          .from('closures')
          .select('id, doctor_id, start_at, end_at, reason, note, status, created_at')
          .eq('status', 'active')
          .gte('end_at', nowISO)
          .order('start_at', { ascending: true })

        if (!isMounted) return

        if (fetchErr) {
          throw new Error(fetchErr.message)
        }

        const activeList = data || []
        setError(null)
        setClosures(activeList)

        // Informational check: calculate total unhandled bookings across all active closures
        if (activeList.length > 0) {
          let totalCount = 0
          let firstIdWithBookings = null

          for (const cl of activeList) {
            const { count, error: apptErr } = await supabase
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('doctor_id', 1)
              .in('status', ['booked', 'confirmed'])
              .gte('slot_start', cl.start_at)
              .lt('slot_start', cl.end_at)

            if (!apptErr && typeof count === 'number' && count > 0) {
              totalCount += count
              if (!firstIdWithBookings) {
                firstIdWithBookings = cl.id
              }
            }
          }

          if (isMounted) {
            setAttentionData({ count: totalCount, firstId: firstIdWithBookings })
          }
        } else {
          if (isMounted) {
            setAttentionData({ count: 0, firstId: null })
          }
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Error fetching closures:', err)
        setError('Unable to load clinic closures. Please try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchActiveClosures()

    const interval = setInterval(() => {
      if (isMounted) {
        fetchActiveClosures()
      }
    }, 60000)

    const handleFocus = () => {
      if (isMounted) {
        fetchActiveClosures()
      }
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [reloadKey])

  // Lazy load past closures on toggle
  const loadPastClosures = async () => {
    setLoadingPast(true)
    try {
      const nowISO = new Date().toISOString()

      const { data, error: pastErr } = await supabase
        .from('closures')
        .select('id, doctor_id, start_at, end_at, reason, note, status, created_at, removed_at')
        .or(`status.eq.removed,end_at.lt.${nowISO}`)
        .order('start_at', { ascending: false })
        .limit(20)

      if (pastErr) {
        console.error('Error fetching past closures:', pastErr.message)
      } else {
        setPastClosures(data || [])
        setPastLoaded(true)
      }
    } catch (err) {
      console.error('Unexpected error loading past closures:', err)
    } finally {
      setLoadingPast(false)
    }
  }

  const handleTogglePast = () => {
    const nextState = !pastExpanded
    setPastExpanded(nextState)
    if (nextState && !pastLoaded && !loadingPast) {
      loadPastClosures()
    }
  }

  // Open dialog with optional parameters
  const handleOpenAdd = ({ date = null, type = null } = {}) => {
    setDialogInitialDate(date)
    setDialogInitialType(type)
    setShowAddDialog(true)
  }

  // Handle successful creation of closure
  const handleCreateSuccess = (result) => {
    const affectedCount = result?.affected_count ?? 0
    const newClosureId = result?.closure_id

    if (affectedCount > 0) {
      setToast({
        message: 'Closure added to the calendar',
        type: 'success',
      })
      if (newClosureId) {
        setAutoExpandId(newClosureId)
        setHighlightedId(newClosureId)
        setTimeout(() => setHighlightedId(null), 3000)
      }
    } else {
      setToast({
        message: 'No bookings were affected',
        type: 'success',
      })
    }

    setReloadKey((k) => k + 1)
  }

  // Handle successful removal of closure
  const handleRemoveSuccess = () => {
    setToast({
      message: 'Closure removed. Those times are open again.',
      type: 'success',
    })
    setReloadKey((k) => k + 1)
    setPastLoaded(false)
  }

  // Scroll to closure and expand its bookings
  const handleReviewAttention = () => {
    if (attentionData.firstId) {
      setAutoExpandId(attentionData.firstId)
      setHighlightedId(attentionData.firstId)
      setTimeout(() => setHighlightedId(null), 3000)

      const el = closureCardRefs.current[attentionData.firstId]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Find active closure that overlaps today in IST
  const todayClosure = useMemo(() => {
    const todayStartUTC = new Date(`${todayIST}T00:00:00+05:30`).toISOString()
    const todayEndUTC = new Date(`${todayIST}T23:59:59.999+05:30`).toISOString()
    return closures.find((cl) => cl.start_at < todayEndUTC && cl.end_at > todayStartUTC) || null
  }, [closures, todayIST])

  // Partition closures into "Happening now" and "Coming up"
  const { happeningNowList, comingUpList } = useMemo(() => {
    const nowISO = new Date().toISOString()
    const happening = []
    const coming = []

    for (const cl of closures) {
      if (cl.start_at <= nowISO && cl.end_at >= nowISO) {
        happening.push(cl)
      } else {
        coming.push(cl)
      }
    }

    return { happeningNowList: happening, comingUpList: coming }
  }, [closures])

  return (
    <div className="page-container closures-page-container">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Header */}
      <header className="page-header page-header-with-actions">
        <div className="header-left">
          <Link to="/" className="btn btn-back">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back</span>
          </Link>
          <div className="header-title-with-help">
            <h1 className="page-heading">Clinic closures</h1>
            <button
              type="button"
              onClick={() => setShowHelpPanel((prev) => !prev)}
              className="btn-closures-help-toggle"
              aria-expanded={showHelpPanel}
              aria-label="How closures work help"
            >
              <Info size={16} aria-hidden="true" />
              <span>How closures work</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAdd()}
          className="btn btn-primary btn-add-closure-header"
          aria-label="Add clinic closure"
        >
          <Plus size={20} aria-hidden="true" />
          <span>Add closure</span>
        </button>
      </header>

      {/* Inline Help Panel: 3 bullets */}
      {showHelpPanel && (
        <div className="closures-how-it-works-panel" role="region" aria-label="How closures work">
          <div className="how-it-works-header">
            <Info size={18} className="how-it-works-icon" aria-hidden="true" />
            <strong>How clinic closures work</strong>
          </div>
          <ul className="how-it-works-list">
            <li>
              A closure blocks the calendar, so the voice agent and the dashboard stop offering
              those times to callers.
            </li>
            <li>
              Existing bookings are <strong>not</strong> changed or cancelled automatically.
            </li>
            <li>
              Call affected patients, then move or cancel their bookings directly from the
              closure card.
            </li>
          </ul>
        </div>
      )}

      {/* Main Content Area */}
      <main className="closures-main-content">
        {/* Loading state: skeleton cards */}
        {loading && (
          <div className="closures-skeleton-grid" aria-busy="true" aria-label="Loading closures">
            <div className="skeleton-card skeleton-closure-card" />
            <div className="skeleton-card skeleton-closure-card" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="card closures-error-state" role="alert">
            <AlertCircle size={32} className="error-icon" aria-hidden="true" />
            <h2 className="error-title">Unable to load closures</h2>
            <p className="error-desc">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setReloadKey((k) => k + 1)
              }}
              className="btn btn-secondary"
            >
              Try again
            </button>
          </div>
        )}

        {/* Main interactive content */}
        {!loading && !error && (
          <>
            {/* 1. Today Status Card */}
            <ClosureTodayStatus
              todayClosure={todayClosure}
              onOpenAdd={handleOpenAdd}
            />

            {/* 2. 14-day horizontally scrollable day strip */}
            <ClosureDayStrip
              closures={closures}
              onSelectDate={(selectedDateKey) =>
                handleOpenAdd({ date: selectedDateKey, type: 'whole_day' })
              }
            />

            {/* 3. Amber "Needs your attention" panel if active closures have bookings */}
            {attentionData.count > 0 && (
              <div className="card closures-attention-banner" role="alert">
                <div className="attention-banner-left">
                  <div className="attention-icon-box">
                    <AlertTriangle size={22} className="attention-alert-icon" aria-hidden="true" />
                  </div>
                  <div className="attention-banner-text">
                    <strong className="attention-banner-title">
                      {attentionData.count}{' '}
                      {attentionData.count === 1 ? 'booking needs' : 'bookings need'} to be moved
                      or cancelled
                    </strong>
                    <p className="attention-banner-sub">
                      Review affected bookings, call the patients, and reschedule or cancel their
                      appointments.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReviewAttention}
                  className="btn btn-warning-action"
                  aria-label="Review closures with bookings requiring attention"
                >
                  Review bookings →
                </button>
              </div>
            )}

            {/* 4. Closures List or Empty State */}
            {closures.length === 0 ? (
              <div className="card closures-empty-panel">
                <div className="closures-empty-icon-tile">
                  <CalendarOff size={32} aria-hidden="true" />
                </div>
                <h2 className="empty-title">No closures planned</h2>
                <p className="empty-desc">The clinic is open on its normal hours.</p>
                <div className="closures-empty-actions-row">
                  <button
                    type="button"
                    onClick={() => handleOpenAdd({ type: 'whole_day' })}
                    className="btn btn-primary"
                  >
                    <Plus size={18} aria-hidden="true" />
                    <span>Plan leave or a holiday</span>
                  </button>
                  {canQuickClose && (
                    <button
                      type="button"
                      onClick={() => handleOpenAdd({ type: 'rest_of_today' })}
                      className="btn btn-secondary"
                    >
                      <Clock size={16} aria-hidden="true" />
                      <span>Close rest of today</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="closures-sections-container">
                {/* Section: Happening now */}
                {happeningNowList.length > 0 && (
                  <section
                    className="closures-group-section"
                    aria-label="Closures happening now"
                  >
                    <div className="closures-section-heading-row">
                      <div className="section-title-wrap">
                        <span className="section-dot-pulsing" aria-hidden="true" />
                        <h2 className="closures-section-title">Happening now</h2>
                      </div>
                      <span className="closures-section-count">
                        {happeningNowList.length}{' '}
                        {happeningNowList.length === 1 ? 'closure' : 'closures'}
                      </span>
                    </div>

                    <div className="closures-cards-list">
                      {happeningNowList.map((cl) => (
                        <div
                          key={cl.id}
                          ref={(el) => {
                            closureCardRefs.current[cl.id] = el
                          }}
                        >
                          <ClosureCard
                            closure={cl}
                            defaultExpanded={autoExpandId === cl.id}
                            isHighlighted={highlightedId === cl.id}
                            onRemoved={handleRemoveSuccess}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section: Coming up */}
                {comingUpList.length > 0 && (
                  <section
                    className="closures-group-section"
                    aria-label="Coming up closures"
                  >
                    <div className="closures-section-heading-row">
                      <h2 className="closures-section-title">Coming up</h2>
                      <span className="closures-section-count">
                        {comingUpList.length}{' '}
                        {comingUpList.length === 1 ? 'closure' : 'closures'}
                      </span>
                    </div>

                    <div className="closures-cards-list">
                      {comingUpList.map((cl) => (
                        <div
                          key={cl.id}
                          ref={(el) => {
                            closureCardRefs.current[cl.id] = el
                          }}
                        >
                          <ClosureCard
                            closure={cl}
                            defaultExpanded={autoExpandId === cl.id}
                            isHighlighted={highlightedId === cl.id}
                            onRemoved={handleRemoveSuccess}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* 5. Past Closures Collapsible */}
            <section className="past-closures-section" aria-label="Past closures">
              <button
                type="button"
                onClick={handleTogglePast}
                className="past-closures-toggle-btn"
                aria-expanded={pastExpanded}
              >
                <div className="past-toggle-left">
                  <Clock size={18} aria-hidden="true" />
                  <span className="past-toggle-label">Past closures</span>
                </div>
                {pastExpanded ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>

              {pastExpanded && (
                <div className="past-closures-panel">
                  {loadingPast ? (
                    <div className="past-closures-loading">
                      <Loader2 size={18} className="spinner-inline" aria-hidden="true" />
                      <span>Loading past closures...</span>
                    </div>
                  ) : pastClosures.length === 0 ? (
                    <p className="past-closures-empty">No past closures</p>
                  ) : (
                    <div className="past-closures-list">
                      {pastClosures.map((pc) => {
                        const dateRange = formatClosureDateRange(pc.start_at, pc.end_at)
                        const windowStr = formatClosureWindow(pc.start_at, pc.end_at)
                        const reasonLabel = formatClosureReason(pc.reason)
                        const isRemoved = pc.status === 'removed'

                        return (
                          <div key={pc.id} className="past-closure-row">
                            <div className="past-row-left">
                              <strong className="past-row-date">{dateRange}</strong>
                              <span className="past-row-window">({windowStr})</span>
                              <span className="past-row-reason">{reasonLabel}</span>
                              {pc.note && (
                                <span className="past-row-note">“{pc.note}”</span>
                              )}
                            </div>
                            <div className="past-row-right">
                              <span
                                className={`past-status-tag ${
                                  isRemoved ? 'past-tag-removed' : 'past-tag-ended'
                                }`}
                              >
                                {isRemoved ? 'Removed' : 'Ended'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Add Closure Dialog Modal (Portaled) */}
      {showAddDialog && (
        <AddClosureDialog
          isOpen={showAddDialog}
          initialDate={dialogInitialDate}
          initialType={dialogInitialType}
          onClose={() => {
            setShowAddDialog(false)
            setDialogInitialDate(null)
            setDialogInitialType(null)
          }}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  )
}
