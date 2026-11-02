import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Info,
  X,
  CalendarOff,
  AlertCircle,
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
} from '../lib/helpers'
import ClosureCard from './ClosureCard'
import AddClosureDialog from './AddClosureDialog'
import Toast from './Toast'

const DISMISS_CLOSURES_INFO_KEY = 'smile_care_dismiss_closures_info_banner'

export default function Closures() {
  const [closures, setClosures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Dialog & Toast states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [toast, setToast] = useState(null) // { message, type }
  const [autoExpandId, setAutoExpandId] = useState(null)

  // Info banner dismissal state
  const [showInfoBanner, setShowInfoBanner] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_CLOSURES_INFO_KEY) !== 'true'
    } catch {
      return true
    }
  })

  // Past closures state (lazy loaded on user toggle)
  const [pastExpanded, setPastExpanded] = useState(false)
  const [pastClosures, setPastClosures] = useState([])
  const [loadingPast, setLoadingPast] = useState(false)
  const [pastLoaded, setPastLoaded] = useState(false)

  const handleDismissBanner = () => {
    setShowInfoBanner(false)
    try {
      localStorage.setItem(DISMISS_CLOSURES_INFO_KEY, 'true')
    } catch {
      // Ignore
    }
  }

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

        setError(null)
        setClosures(data || [])
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
      }
    } else {
      setToast({
        message: 'No bookings were affected',
        type: 'success',
      })
    }

    // Refresh list
    setReloadKey((k) => k + 1)
  }

  // Handle successful removal of closure
  const handleRemoveSuccess = () => {
    setToast({
      message: 'Closure removed. Those times are open again.',
      type: 'success',
    })
    setReloadKey((k) => k + 1)
    setPastLoaded(false) // invalidate past list so it refreshes if opened
  }

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

      {/* a) Header */}
      <header className="page-header page-header-with-actions">
        <div className="header-left">
          <Link to="/" className="btn btn-back">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back</span>
          </Link>
          <h1 className="page-heading">Clinic closures</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="btn btn-primary btn-add-closure-header"
          aria-label="Add clinic closure"
        >
          <Plus size={20} aria-hidden="true" />
          <span>Add closure</span>
        </button>
      </header>

      {/* b) Dismissible Info Note */}
      {showInfoBanner && (
        <div className="sync-info-banner" role="note">
          <div className="sync-banner-content">
            <Info size={18} className="sync-banner-icon" aria-hidden="true" />
            <p className="sync-banner-text">
              A closure blocks the calendar, so the voice agent and the dashboard stop offering those times. Existing bookings are not changed. Move or cancel them and call the patients.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissBanner}
            className="sync-banner-dismiss-btn"
            aria-label="Dismiss info banner"
          >
            <X size={16} />
          </button>
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

        {/* c) Section "Active and upcoming" */}
        {!loading && !error && (
          <>
            {closures.length === 0 ? (
              /* e) Empty state for no active closures */
              <div className="card closures-empty-panel">
                <div className="closures-empty-icon-tile">
                  <CalendarOff size={32} aria-hidden="true" />
                </div>
                <h2 className="empty-title">No closures planned</h2>
                <p className="empty-desc">
                  Block the clinic for doctor leave, events, emergencies or holidays.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddDialog(true)}
                  className="btn btn-primary"
                >
                  <Plus size={18} aria-hidden="true" />
                  <span>Add closure</span>
                </button>
              </div>
            ) : (
              <section className="closures-active-section" aria-label="Active and upcoming closures">
                <div className="closures-section-heading-row">
                  <h2 className="closures-section-title">Active and upcoming</h2>
                  <span className="closures-section-count">
                    {closures.length} {closures.length === 1 ? 'closure' : 'closures'}
                  </span>
                </div>

                <div className="closures-cards-list">
                  {closures.map((cl) => (
                    <ClosureCard
                      key={cl.id}
                      closure={cl}
                      defaultExpanded={autoExpandId === cl.id}
                      onRemoved={handleRemoveSuccess}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* d) Section "Past closures" (collapsible) */}
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

      {/* Add Closure Dialog Modal */}
      {showAddDialog && (
        <AddClosureDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  )
}
