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
        console.error('Error fetching doctors:', err?.message || err)
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Fetch appointments for selectedDate with 60s silent refresh
  useEffect(() => {
    let isMounted = true

    async function loadAppointments(isSilent = false) {
      if (!isSilent) {
        setLoading(true)
      }
      setError(null)

      try {
        const { startUTC, endUTC } = getISTDateRange(selectedDate)

        const { data, error: apptError } = await supabase
          .from('appointments')
          .select(
            'id, call_id, doctor_id, patient_name, patient_phone, reason, slot_start, status, source'
          )
          .gte('slot_start', startUTC)
          .lte('slot_start', endUTC)
          .order('slot_start', { ascending: true })

        if (!isMounted) return
        if (apptError) throw apptError

        setAppointments(data || [])
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load appointments:', err?.message || err)
        setError('Unable to load bookings. Please check your connection and try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAppointments(false)

    const interval = setInterval(() => {
      if (isMounted && !isBusyRef.current) {
        loadAppointments(true)
      }
    }, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [selectedDate, reloadKey])

  // Date switch handlers
  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() - 1)
    setSelectedDate(getISTDateKey(d))
    setConfirmState(null)
  }

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() + 1)
    setSelectedDate(getISTDateKey(d))
    setConfirmState(null)
  }

  const handleToday = () => {
    setSelectedDate(getTodayIST())
    setConfirmState(null)
  }

  // Regular status update (Arrived, Completed, No-show) - writes directly to appointments.status
  const executeStatusUpdate = async (apptId, newStatus) => {
    setSavingId(apptId)
    setSavingTarget(newStatus)
    setSaveErrors((prev) => ({ ...prev, [apptId]: null }))
    setConfirmState(null)

    try {
      const { data, error: updateError } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', apptId)
        .select()

      if (updateError || !data || data.length !== 1) {
        setSaveErrors((prev) => ({
          ...prev,
          [apptId]: 'Could not save status. Please try again.',
        }))
      } else {
        setAppointments((prev) =>
          prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a))
        )
        const labels = {
          arrived: 'Marked as arrived',
          completed: 'Marked as completed',
          no_show: 'Marked as no-show',
          booked: 'Marked as booked',
        }
        setToast({
          message: labels[newStatus] || 'Status updated',
          type: 'success',
        })
      }
    } catch {
      setSaveErrors((prev) => ({
        ...prev,
        [apptId]: 'Could not save status. Please try again.',
      }))
    } finally {
      setSavingId(null)
      setSavingTarget(null)
    }
  }

  // Cancel booking action - calls manage-appointment edge function
  const executeCancelBooking = async (apptId) => {
    setSavingId(apptId)
    setSavingTarget('cancelled')
    setSaveErrors((prev) => ({ ...prev, [apptId]: null }))
    setConfirmState(null)

    try {
      const res = await invokeManageAppointment({
        action: 'cancel',
        appointment_id: Number(apptId),
      })

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === apptId ? { ...a, status: 'cancelled' } : a))
        )
        setToast({
          message: 'Booking cancelled and removed from the calendar',
          type: 'success',
        })
      } else {
        setSaveErrors((prev) => ({
          ...prev,
          [apptId]: res.error || 'Could not cancel booking. Please try again.',
        }))
      }
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [apptId]: err?.message || 'Could not cancel booking. Please try again.',
      }))
    } finally {
      setSavingId(null)
      setSavingTarget(null)
    }
  }

  // Handle status button click
  const handleStatusClick = (appt, targetStatus) => {
    if (appt.status === targetStatus) return

    if (targetStatus === 'cancelled') {
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

  // Compute status filter counts over all loaded bookings for the viewed day
  const filterCounts = useMemo(() => {
    const counts = {
      all: appointments.length,
      upcoming: 0,
      arrived: 0,
      completed: 0,
      no_show: 0,
      cancelled: 0,
    }

    for (const appt of appointments) {
      if (appt.status === 'booked' || appt.status === 'confirmed') {
        counts.upcoming += 1
      } else if (counts[appt.status] !== undefined) {
        counts[appt.status] += 1
      }
    }

    return counts
  }, [appointments])

  // Fallback to 'all' if selected filter count drops to zero
  const effectiveFilter = useMemo(() => {
    if (activeFilter === 'all') return 'all'
    if (!filterCounts[activeFilter] || filterCounts[activeFilter] === 0) {
      return 'all'
    }
    return activeFilter
  }, [activeFilter, filterCounts])

  // Filtered appointments list
  const filteredAppointments = useMemo(() => {
    if (effectiveFilter === 'all') return appointments
    if (effectiveFilter === 'upcoming') {
      return appointments.filter(
        (a) => a.status === 'booked' || a.status === 'confirmed'
      )
    }
    return appointments.filter((a) => a.status === effectiveFilter)
  }, [appointments, effectiveFilter])

  const todayIST = getTodayIST()
  const isToday = selectedDate === todayIST
  const isSunday = isSundayIST(selectedDate)
  const isPastDay = selectedDate < todayIST
  const formattedDateLabel = formatISTDateLabel(selectedDate)

  // Determine "NEXT UP" index and "Time has passed" for today's view
  const nextUpApptId = useMemo(() => {
    if (!isToday) return null
    const now = Date.now()
    const upcoming = appointments.find((a) => {
      const isBookedOrConfirmed = a.status === 'booked' || a.status === 'confirmed'
      if (!isBookedOrConfirmed) return false
      const slotTime = new Date(a.slot_start).getTime()
      return slotTime > now
    })
    return upcoming ? upcoming.id : null
  }, [isToday, appointments])

  // Group appointments by doctor if more than one doctor has bookings
  const doctorGroups = useMemo(() => {
    const distinctDoctors = new Set(
      filteredAppointments.map((a) => a.doctor_id || 'unknown')
    )
    if (distinctDoctors.size <= 1) {
      return null // Don't group by doctor if only 1 doctor
    }

    const groups = {}
    for (const a of filteredAppointments) {
      const docId = a.doctor_id || 'unknown'
      if (!groups[docId]) {
        groups[docId] = []
      }
      groups[docId].push(a)
    }
    return groups
  }, [filteredAppointments])

  const totalBookingsText = `${filteredAppointments.length} ${
    filteredAppointments.length === 1 ? 'booking' : 'bookings'
  }`

  return (
    <div className="page-container">
      {/* Toast Alert */}
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

      {/* 2. Info Sync Banner */}
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

      {/* 3. Day Navigator Card */}
      <DayNavigator
        selectedDate={selectedDate}
        todayIST={todayIST}
        formattedDateLabel={formattedDateLabel}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
        onDateChange={(newDate) => {
          setSelectedDate(newDate)
          setConfirmState(null)
        }}
      />

      {/* 4. Status Filter Chips (Single Select) */}
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
