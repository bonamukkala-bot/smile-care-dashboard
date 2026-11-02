import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  ArrowLeft,
  Info,
  X,
  CalendarCheck,
  CalendarOff,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  getISTDateRange,
  getISTDateKey,
  formatISTDateLabel,
  isSundayIST,
  formatDoctorName,
  invokeManageAppointment,
} from '../lib/helpers'
import DayNavigator from './DayNavigator'
import BookingCard from './BookingCard'
import NewBookingModal from './NewBookingModal'
import Toast from './Toast'
import ClosureNotice from './ClosureNotice'

const HIDE_SYNC_BANNER_KEY = 'smile_care_hide_booking_sync_banner'

export default function TodayBookings() {
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST())
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Status filter chip state
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'upcoming' | 'arrived' | 'completed' | 'no_show' | 'cancelled'

  // Sync banner visibility from localStorage
  const [showSyncBanner, setShowSyncBanner] = useState(() => {
    try {
      return localStorage.getItem(HIDE_SYNC_BANNER_KEY) !== 'true'
    } catch {
      return true
    }
  })

  // Status mutation states per card
  const [savingId, setSavingId] = useState(null)
  const [savingTarget, setSavingTarget] = useState(null)
  const [saveErrors, setSaveErrors] = useState({})
  const [confirmState, setConfirmState] = useState(null) // { apptId, targetStatus }

  // Shared toast state
  const [toast, setToast] = useState(null) // { message, type }

  // New Booking Modal state
  const [showNewBooking, setShowNewBooking] = useState(false)

  // Track busy state to avoid background polling collisions
  const isBusy = savingId !== null || confirmState !== null
  const isBusyRef = useRef(isBusy)

  useEffect(() => {
    isBusyRef.current = isBusy
  }, [isBusy])

  const handleDismissSyncBanner = () => {
    setShowSyncBanner(false)
    try {
      localStorage.setItem(HIDE_SYNC_BANNER_KEY, 'true')
    } catch {
      // Ignore localStorage errors
    }
  }

  // 1. Fetch doctors table once on mount
  useEffect(() => {
    let isMounted = true

    async function loadDoctors() {
      try {
        const { data, error: docError } = await supabase
          .from('doctors')
          .select('id, name')

        if (!isMounted) return
        if (docError) {
          console.error('Failed to load doctors:', docError.message)
          return
        }

        const map = {}
        for (const doc of data || []) {
          map[doc.id] = doc.name
        }
        setDoctors(map)
      } catch (err) {
        if (!isMounted) return
        console.error('Unexpected error loading doctors:', err)
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Fetch appointments for selectedDate with 60s background polling
  useEffect(() => {
    let isMounted = true

    async function loadAppointments() {
      // Avoid replacing data while staff is actively confirming or updating a status
      if (isBusyRef.current) return

      try {
        setLoading(true)
        setError(null)

        const { startUTC, endUTC } = getISTDateRange(selectedDate)

        const { data, error: queryError } = await supabase
          .from('appointments')
          .select(
            'id, doctor_id, patient_name, patient_phone, slot_start, reason, status, source, notes, google_event_id'
          )
          .gte('slot_start', startUTC)
          .lte('slot_start', endUTC)
          .order('slot_start', { ascending: true })

        if (!isMounted) return

        if (queryError) {
          console.error('Error querying bookings:', queryError.message)
          setError('Failed to load bookings. Please check connection.')
          setAppointments([])
        } else {
          setAppointments(data || [])
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Unexpected error loading bookings:', err)
        setError('An unexpected error occurred while loading bookings.')
        setAppointments([])
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAppointments()

    // 60-second polling refresh with cleanup
    const interval = setInterval(() => {
      if (isMounted) {
        loadAppointments()
      }
    }, 60000)

    // Window focus refresh
    const handleFocus = () => {
      if (isMounted) {
        loadAppointments()
      }
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [selectedDate, reloadKey])

  // Date step navigators
  const handlePrevDay = () => {
    try {
      const d = new Date(`${selectedDate}T12:00:00+05:30`)
      d.setDate(d.getDate() - 1)
      setSelectedDate(getISTDateKey(d))
    } catch {
      // Ignore
    }
  }

  const handleNextDay = () => {
    try {
      const d = new Date(`${selectedDate}T12:00:00+05:30`)
      d.setDate(d.getDate() + 1)
      setSelectedDate(getISTDateKey(d))
    } catch {
      // Ignore
    }
  }

  const handleToday = () => {
    setSelectedDate(getTodayIST())
  }

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts = {
      all: 0,
      upcoming: 0,
      arrived: 0,
      completed: 0,
      no_show: 0,
      cancelled: 0,
    }

    for (const appt of appointments) {
      if (appt.status !== 'cancelled') {
        counts.all++
      }
      if (appt.status === 'booked' || appt.status === 'confirmed') {
        counts.upcoming++
      } else if (appt.status === 'arrived') {
        counts.arrived++
      } else if (appt.status === 'completed') {
        counts.completed++
      } else if (appt.status === 'no_show') {
        counts.no_show++
      } else if (appt.status === 'cancelled') {
        counts.cancelled++
      }
    }
    return counts
  }, [appointments])

  // Reset filter to 'all' if selected filter has 0 items
  const effectiveFilter = useMemo(() => {
    if (activeFilter !== 'all' && filterCounts[activeFilter] === 0) {
      return 'all'
    }
    return activeFilter
  }, [activeFilter, filterCounts])

  // Filtered list
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (effectiveFilter === 'all') {
        return appt.status !== 'cancelled'
      }
      if (effectiveFilter === 'upcoming') {
        return appt.status === 'booked' || appt.status === 'confirmed'
      }
      return appt.status === effectiveFilter
    })
  }, [appointments, effectiveFilter])

  // Next up appointment for TODAY
  const todayIST = getTodayIST()
  const isToday = selectedDate === todayIST
  const isSunday = isSundayIST(selectedDate)
  const isPastDay = selectedDate < todayIST
  const formattedDateLabel = formatISTDateLabel(selectedDate)

  const nextUpApptId = useMemo(() => {
    if (!isToday) return null
    const now = Date.now()
    const upcoming = appointments.find((a) => {
      const isBookedOrConfirmed = a.status === 'booked' || a.status === 'confirmed'
      if (!isBookedOrConfirmed) return false
      return new Date(a.slot_start).getTime() > now
    })
    return upcoming ? upcoming.id : null
  }, [isToday, appointments])

  // Multiple doctors grouping
  const doctorGroups = useMemo(() => {
    const docIds = new Set(filteredAppointments.map((a) => a.doctor_id))
    if (docIds.size <= 1) return null

    const groups = {}
    for (const appt of filteredAppointments) {
      const docId = appt.doctor_id || 'unassigned'
      if (!groups[docId]) groups[docId] = []
      groups[docId].push(appt)
    }
    return groups
  }, [filteredAppointments])

  // Direct status updates (Arrived, Completed, No-show)
  const executeStatusUpdate = async (apptId, targetStatus) => {
    setSavingId(apptId)
    setSavingTarget(targetStatus)
    setSaveErrors((prev) => ({ ...prev, [apptId]: null }))

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: targetStatus })
        .eq('id', apptId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Optimistic update locally
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: targetStatus } : a))
      )

      setConfirmState(null)
      setToast({
        message: `Status updated to ${targetStatus.replace('_', '-')}`,
        type: 'success',
      })
    } catch (err) {
      console.error('Failed to update status:', err)
      setSaveErrors((prev) => ({
        ...prev,
        [apptId]: 'Could not update status. Please try again.',
      }))
    } finally {
      setSavingId(null)
      setSavingTarget(null)
    }
  }

  // Cancel booking via Supabase Edge Function
  const executeCancelBooking = async (apptId) => {
    setSavingId(apptId)
    setSavingTarget('cancelled')
    setSaveErrors((prev) => ({ ...prev, [apptId]: null }))

    try {
      const res = await invokeManageAppointment({
        action: 'cancel',
        appointment_id: apptId,
      })

      if (!res.ok) {
        setSaveErrors((prev) => ({
          ...prev,
          [apptId]: res.error || 'Failed to cancel booking. Please try again.',
        }))
        return
      }

      // Update state locally
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: 'cancelled' } : a))
      )
      setConfirmState(null)
      setToast({
        message: 'Booking cancelled and synced with Google Calendar',
        type: 'success',
      })
    } catch (err) {
      console.error('Cancellation exception:', err)
      setSaveErrors((prev) => ({
        ...prev,
        [apptId]: err?.message || 'Failed to cancel booking. Please try again.',
      }))
    } finally {
      setSavingId(null)
      setSavingTarget(null)
    }
  }

  const handleStatusClick = (appt, targetStatus) => {
    // Both No-show and Cancelled require explicit confirmation
    if (targetStatus === 'cancelled' || targetStatus === 'no_show') {
      setConfirmState({ apptId: appt.id, targetStatus })
      setSaveErrors((prev) => ({ ...prev, [appt.id]: null }))
    } else {
      executeStatusUpdate(appt.id, targetStatus)
    }
  }

  const handleConfirmYes = (appt, targetStatus) => {
    if (targetStatus === 'cancelled') {
      executeCancelBooking(appt.id)
    } else {
      executeStatusUpdate(appt.id, targetStatus)
    }
  }

  const handleConfirmNo = () => {
    setConfirmState(null)
  }

  const handleNewBookingSuccess = (msg) => {
    setToast({
      message: msg || 'Booking added to the calendar',
      type: 'success',
    })
    setReloadKey((prev) => prev + 1)
  }

  const totalBookingsText = `${filteredAppointments.length} ${
    filteredAppointments.length === 1 ? 'booking' : 'bookings'
  }`

  return (
    <div className="page-container">
      {/* Toast alert */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* 1. Header row */}
      <header className="page-header page-header-with-actions">
        <div className="header-left">
          <Link to="/" className="btn btn-back">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back</span>
          </Link>
          <h1 className="page-heading">Today's Bookings</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNewBooking(true)}
          className="btn btn-primary btn-new-booking-header"
          aria-label="Create new booking"
        >
          <Plus size={20} aria-hidden="true" />
          <span>New booking</span>
        </button>
      </header>

      {/* 2. Synchronisation info note */}
      {showSyncBanner && (
        <div className="sync-info-banner" role="note">
          <div className="sync-banner-content">
            <Info size={18} className="sync-banner-icon" aria-hidden="true" />
            <p className="sync-banner-text">
              Creating, moving and cancelling bookings updates Google Calendar. Arrived,
              Completed and No-show do not.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissSyncBanner}
            className="sync-banner-dismiss-btn"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. Day Navigator */}
      <DayNavigator
        selectedDate={selectedDate}
        todayIST={todayIST}
        formattedDateLabel={formattedDateLabel}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
        onDateChange={setSelectedDate}
      />

      {/* 4. Filter chips bar */}
      <div
        className="booking-filter-chips-bar"
        role="tablist"
        aria-label="Filter bookings by status"
      >
        <button
          type="button"
          role="tab"
          aria-selected={effectiveFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          className={`filter-chip ${
            effectiveFilter === 'all' ? 'filter-chip-active' : ''
          }`}
        >
          All ({filterCounts.all})
        </button>

        {filterCounts.upcoming > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveFilter === 'upcoming'}
            onClick={() => setActiveFilter('upcoming')}
            className={`filter-chip ${
              effectiveFilter === 'upcoming' ? 'filter-chip-active' : ''
            }`}
          >
            Upcoming ({filterCounts.upcoming})
          </button>
        )}

        {filterCounts.arrived > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveFilter === 'arrived'}
            onClick={() => setActiveFilter('arrived')}
            className={`filter-chip ${
              effectiveFilter === 'arrived' ? 'filter-chip-active' : ''
            }`}
          >
            Arrived ({filterCounts.arrived})
          </button>
        )}

        {filterCounts.completed > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveFilter === 'completed'}
            onClick={() => setActiveFilter('completed')}
            className={`filter-chip ${
              effectiveFilter === 'completed' ? 'filter-chip-active' : ''
            }`}
          >
            Completed ({filterCounts.completed})
          </button>
        )}

        {filterCounts.no_show > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveFilter === 'no_show'}
            onClick={() => setActiveFilter('no_show')}
            className={`filter-chip ${
              effectiveFilter === 'no_show' ? 'filter-chip-active' : ''
            }`}
          >
            No-show ({filterCounts.no_show})
          </button>
        )}

        {filterCounts.cancelled > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveFilter === 'cancelled'}
            onClick={() => setActiveFilter('cancelled')}
            className={`filter-chip ${
              effectiveFilter === 'cancelled' ? 'filter-chip-active' : ''
            }`}
          >
            Cancelled ({filterCounts.cancelled})
          </button>
        )}
      </div>

      {/* 5. Count Divider Row */}
      <div className="bookings-count-divider-row">
        <span className="bookings-count-label">{totalBookingsText}</span>
        <div className="count-hairline" />
      </div>

      {/* 6. Main Bookings List / States */}
      <main className="bookings-main-content">
        {/* Loading Skeletons */}
        {loading && (
          <div className="bookings-skeleton-list" aria-busy="true" aria-label="Loading bookings">
            <div className="skeleton-card skeleton-booking-card" />
            <div className="skeleton-card skeleton-booking-card" />
            <div className="skeleton-card skeleton-booking-card" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card error-card-modern" role="alert">
            <AlertCircle size={28} className="error-icon" aria-hidden="true" />
            <p className="error-text">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setError(null)
                setReloadKey((prev) => prev + 1)
              }}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Closure Notice */}
        {!loading && !error && (
          <ClosureNotice dateStr={selectedDate} compact={true} />
        )}

        {/* Empty State: Sunday */}
        {!loading && !error && appointments.length === 0 && isSunday && (
          <div className="card empty-bookings-card" role="status">
            <div className="empty-icon-tile">
              <CalendarOff size={32} className="empty-tile-icon" aria-hidden="true" />
            </div>
            <h3 className="empty-title">The clinic is closed on Sundays.</h3>
            <p className="empty-subtitle">
              Regular operating hours are Monday through Saturday.
            </p>
          </div>
        )}

        {/* Empty State: Weekday with 0 Bookings */}
        {!loading && !error && appointments.length === 0 && !isSunday && (
          <div className="card empty-bookings-card" role="status">
            <div className="empty-icon-tile">
              <CalendarCheck size={32} className="empty-tile-icon" aria-hidden="true" />
            </div>
            <h3 className="empty-title">No bookings for this day</h3>
            <p className="empty-subtitle">
              There are no scheduled appointments for {formattedDateLabel}.
            </p>
            {!isPastDay && (
              <button
                type="button"
                onClick={() => setShowNewBooking(true)}
                className="btn btn-primary btn-empty-new-booking"
              >
                <Plus size={18} aria-hidden="true" />
                <span>+ New booking</span>
              </button>
            )}
          </div>
        )}

        {/* Empty Filter State (items exist for the day, but none for the chosen filter) */}
        {!loading && !error && appointments.length > 0 && filteredAppointments.length === 0 && (
          <div className="card empty-filter-card" role="status">
            <p className="empty-filter-title">No bookings with this status</p>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="btn btn-secondary btn-clear-filter"
            >
              Show all
            </button>
          </div>
        )}

        {/* Render Bookings List */}
        {!loading && !error && filteredAppointments.length > 0 && (
          <div className="bookings-cards-container">
            {doctorGroups ? (
              // Grouped by Doctor
              Object.entries(doctorGroups).map(([docId, docAppts]) => {
                const docName = doctors[docId] || 'Doctor'
                const formattedDoctor = formatDoctorName(docName)

                return (
                  <section key={docId} className="doctor-bookings-group">
                    <div className="doctor-group-header">
                      <h3 className="doctor-group-title">
                        {formattedDoctor}
                      </h3>
                      <span className="doctor-group-count">
                        {docAppts.length} {docAppts.length === 1 ? 'booking' : 'bookings'}
                      </span>
                    </div>

                    <div className="bookings-cards-list">
                      {docAppts.map((appt) => {
                        const isNextUp = isToday && appt.id === nextUpApptId
                        const isPastUnfinished =
                          isToday &&
                          (appt.status === 'booked' || appt.status === 'confirmed') &&
                          new Date(appt.slot_start).getTime() < Date.now()

                        return (
                          <BookingCard
                            key={appt.id}
                            appointment={appt}
                            doctorName={docName}
                            isNextUp={isNextUp}
                            isPastUnfinished={isPastUnfinished}
                            isSaving={savingId === appt.id}
                            savingTarget={savingTarget}
                            isConfirming={confirmState?.apptId === appt.id}
                            confirmTarget={confirmState?.targetStatus}
                            saveError={saveErrors[appt.id]}
                            onStatusClick={handleStatusClick}
                            onConfirmYes={handleConfirmYes}
                            onConfirmNo={handleConfirmNo}
                          />
                        )
                      })}
                    </div>
                  </section>
                )
              })
            ) : (
              // Single Doctor or Unknown Doctor: Direct List
              <div className="bookings-cards-list">
                {filteredAppointments.map((appt) => {
                  const docName = doctors[appt.doctor_id] || 'Doctor'
                  const isNextUp = isToday && appt.id === nextUpApptId
                  const isPastUnfinished =
                    isToday &&
                    (appt.status === 'booked' || appt.status === 'confirmed') &&
                    new Date(appt.slot_start).getTime() < Date.now()

                  return (
                    <BookingCard
                      key={appt.id}
                      appointment={appt}
                      doctorName={docName}
                      isNextUp={isNextUp}
                      isPastUnfinished={isPastUnfinished}
                      isSaving={savingId === appt.id}
                      savingTarget={savingTarget}
                      isConfirming={confirmState?.apptId === appt.id}
                      confirmTarget={confirmState?.targetStatus}
                      saveError={saveErrors[appt.id]}
                      onStatusClick={handleStatusClick}
                      onConfirmYes={handleConfirmYes}
                      onConfirmNo={handleConfirmNo}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* New Booking Modal */}
      {showNewBooking && (
        <NewBookingModal
          isOpen={showNewBooking}
          onClose={() => setShowNewBooking(false)}
          onSuccess={handleNewBookingSuccess}
          initialDate={selectedDate}
        />
      )}
    </div>
  )
}
