import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  ArrowLeft,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
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
  getISTWeekDays,
  formatISTWeekLabel,
  isSundayIST,
  formatDoctorName,
  invokeManageAppointment,
} from '../lib/helpers'
import ViewSwitcher from './ViewSwitcher'
import DayNavigator from './DayNavigator'
import FilterPanel from './FilterPanel'
import WeekBoard from './WeekBoard'
import AppointmentRow from './AppointmentRow'
import BookingCard from './BookingCard'
import NewBookingModal from './NewBookingModal'
import Toast from './Toast'
import ClosureNotice from './ClosureNotice'

const HIDE_SYNC_BANNER_KEY = 'smile_care_hide_booking_sync_banner'
const VIEW_MODE_STORAGE_KEY = 'smile_care_appointments_view_mode'

const STATUS_OPTIONS = [
  'booked',
  'confirmed',
  'arrived',
  'completed',
  'no_show',
  'cancelled',
]

export default function Appointments() {
  // 1. View Mode with sessionStorage persistence
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY)
      if (saved === 'day' || saved === 'week' || saved === 'list') {
        return saved
      }
    } catch {
      // Ignore sessionStorage errors
    }
    return 'day'
  })

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    try {
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // Ignore
    }
  }

  // 2. Date state
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST())
  const [showPastList, setShowPastList] = useState(false)

  // 3. Raw Data
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // 4. Universal Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterDoctor, setFilterDoctor] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  // 5. Shared Sync Banner & Toast
  const [showSyncBanner, setShowSyncBanner] = useState(() => {
    try {
      return localStorage.getItem(HIDE_SYNC_BANNER_KEY) !== 'true'
    } catch {
      return true
    }
  })
  const [toast, setToast] = useState(null) // { message, type }

  // 6. Modal & In-card mutations (for Day View BookingCards)
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [savingTarget, setSavingTarget] = useState(null)
  const [saveErrors, setSaveErrors] = useState({})
  const [confirmState, setConfirmState] = useState(null) // { apptId, targetStatus }

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
      // Ignore
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

  // 2. Fetch appointments based on active viewMode and date range
  useEffect(() => {
    let isMounted = true

    async function loadAppointments() {
      // If busy confirming or updating, do not wipe/replace list
      if (isBusyRef.current) return

      try {
        setLoading(true)
        setError(null)

        let query = supabase
          .from('appointments')
          .select(
            'id, doctor_id, patient_name, patient_phone, slot_start, reason, status, source, notes, google_event_id'
          )

        if (viewMode === 'day') {
          // Exactly 1 day in IST
          const { startUTC, endUTC } = getISTDateRange(selectedDate)
          query = query
            .gte('slot_start', startUTC)
            .lte('slot_start', endUTC)
            .order('slot_start', { ascending: true })
        } else if (viewMode === 'week') {
          // 7 days of the selected week (Mon 00:00 to Sun 23:59:59.999 IST)
          const weekDays = getISTWeekDays(selectedDate)
          const mondayDate = weekDays[0] || selectedDate
          const sundayDate = weekDays[6] || selectedDate
          const { startUTC } = getISTDateRange(mondayDate)
          const { endUTC } = getISTDateRange(sundayDate)

          query = query
            .gte('slot_start', startUTC)
            .lte('slot_start', endUTC)
            .order('slot_start', { ascending: true })
        } else if (viewMode === 'list') {
          // List view: Upcoming (today onward) or Past 30 days
          const today = getTodayIST()
          if (!showPastList) {
            const { startUTC } = getISTDateRange(today)
            query = query
              .gte('slot_start', startUTC)
              .order('slot_start', { ascending: true })
              .limit(100)
          } else {
            // Past 30 days up to today
            const past30D = new Date(`${today}T00:00:00+05:30`)
            past30D.setDate(past30D.getDate() - 30)
            const past30Str = getISTDateKey(past30D)
            const { startUTC } = getISTDateRange(past30Str)
            const { endUTC } = getISTDateRange(today)

            query = query
              .gte('slot_start', startUTC)
              .lte('slot_start', endUTC)
              .order('slot_start', { ascending: false })
              .limit(100)
          }
        }

        const { data, error: queryError } = await query

        if (!isMounted) return

        if (queryError) {
          console.error('Error querying appointments:', queryError.message)
          setError('Failed to load appointments. Please check connection.')
          setAppointments([])
        } else {
          setAppointments(data || [])
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Unexpected error loading appointments:', err)
        setError('An unexpected error occurred while loading appointments.')
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
  }, [viewMode, selectedDate, showPastList, reloadKey])

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

  const handlePrevWeek = () => {
    try {
      const d = new Date(`${selectedDate}T12:00:00+05:30`)
      d.setDate(d.getDate() - 7)
      setSelectedDate(getISTDateKey(d))
    } catch {
      // Ignore
    }
  }

  const handleNextWeek = () => {
    try {
      const d = new Date(`${selectedDate}T12:00:00+05:30`)
      d.setDate(d.getDate() + 7)
      setSelectedDate(getISTDateKey(d))
    } catch {
      // Ignore
    }
  }

  const handleThisWeek = () => {
    setSelectedDate(getTodayIST())
  }

  // 3. Client-side Universal Filtering
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // Exclude cancelled unless toggle is active or explicit filter is 'cancelled'
      if (!showCancelled && filterStatus !== 'cancelled' && appt.status === 'cancelled') {
        return false
      }

      // Status filter
      if (filterStatus !== 'all' && appt.status !== filterStatus) {
        return false
      }

      // Source filter
      if (filterSource !== 'all') {
        const apptSource = (appt.source || 'staff').toLowerCase()
        if (filterSource === 'voice' && apptSource !== 'voice') return false
        if (filterSource === 'staff' && apptSource !== 'staff') return false
      }

      // Doctor filter
      if (filterDoctor !== 'all') {
        if (String(appt.doctor_id) !== String(filterDoctor)) return false
      }

      // Search query (patient name or phone)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const nameMatch = (appt.patient_name || '').toLowerCase().includes(query)
        const phoneMatch = (appt.patient_phone || '').includes(query)
        if (!nameMatch && !phoneMatch) return false
      }

      return true
    })
  }, [appointments, showCancelled, filterStatus, filterSource, filterDoctor, searchQuery])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterStatus !== 'all') count++
    if (filterSource !== 'all') count++
    if (filterDoctor !== 'all') count++
    if (searchQuery.trim()) count++
    if (showCancelled) count++
    return count
  }, [filterStatus, filterSource, filterDoctor, searchQuery, showCancelled])

  const hasActiveFilters = activeFilterCount > 0

  const handleClearFilters = () => {
    setFilterStatus('all')
    setFilterSource('all')
    setFilterDoctor('all')
    setSearchQuery('')
    setShowCancelled(false)
  }

  // Grouping for Day View (by doctor)
  const dayGroupedByDoctor = useMemo(() => {
    if (viewMode !== 'day') return null
    const docIds = new Set(filteredAppointments.map((a) => a.doctor_id))
    if (docIds.size <= 1) return null

    const groups = {}
    for (const appt of filteredAppointments) {
      const docId = appt.doctor_id || 'unassigned'
      if (!groups[docId]) groups[docId] = []
      groups[docId].push(appt)
    }
    return groups
  }, [viewMode, filteredAppointments])

  // Grouping for Week View (by Monday..Sunday day key)
  const weekDays = useMemo(() => getISTWeekDays(selectedDate), [selectedDate])
  const weekGroupedByDay = useMemo(() => {
    if (viewMode !== 'week') return {}
    const map = {}
    for (const dayKey of weekDays) {
      map[dayKey] = []
    }
    for (const appt of filteredAppointments) {
      const key = getISTDateKey(appt.slot_start)
      if (map[key]) {
        map[key].push(appt)
      }
    }
    return map
  }, [viewMode, weekDays, filteredAppointments])

  // Grouping for List View (by date key)
  const listGroupedByDate = useMemo(() => {
    if (viewMode !== 'list') return {}
    const map = {}
    for (const appt of filteredAppointments) {
      const key = getISTDateKey(appt.slot_start)
      if (!map[key]) map[key] = []
      map[key].push(appt)
    }
    return map
  }, [viewMode, filteredAppointments])

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
      console.error('Failed to update appointment status:', err)
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

  const todayIST = getTodayIST()
  const isTodaySelected = selectedDate === todayIST
  const isSunday = isSundayIST(selectedDate)
  const isPastDay = selectedDate < todayIST
  const formattedDateLabel = formatISTDateLabel(selectedDate)

  const nextUpApptId = useMemo(() => {
    if (!isTodaySelected) return null
    const now = Date.now()
    const upcoming = appointments.find((a) => {
      const isBookedOrConfirmed = a.status === 'booked' || a.status === 'confirmed'
      if (!isBookedOrConfirmed) return false
      return new Date(a.slot_start).getTime() > now
    })
    return upcoming ? upcoming.id : null
  }, [isTodaySelected, appointments])

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
          <h1 className="page-heading">Appointments</h1>
        </div>
        <div className="header-actions-group">
          <Link
            to="/closures"
            className="btn btn-secondary btn-closures-header"
            aria-label="Clinic closures"
          >
            <CalendarOff size={18} aria-hidden="true" />
            <span className="btn-text-responsive">Clinic closures</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowNewBooking(true)}
            className="btn btn-primary btn-new-booking-header"
            aria-label="Create new booking"
          >
            <Plus size={20} aria-hidden="true" />
            <span>New booking</span>
          </button>
        </div>
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

      {/* 3. View Switcher Tabs (Day view, Week view, List view) */}
      <ViewSwitcher
        viewMode={viewMode}
        onChangeView={handleViewModeChange}
      />

      {/* 4. Date Navigators based on View Mode */}
      {viewMode === 'day' && (
        <DayNavigator
          selectedDate={selectedDate}
          todayIST={todayIST}
          formattedDateLabel={formattedDateLabel}
          onPrevDay={handlePrevDay}
          onNextDay={handleNextDay}
          onToday={handleToday}
          onDateChange={setSelectedDate}
        />
      )}

      {viewMode === 'week' && (
        <section className="card week-nav-card" aria-label="Week Navigation">
          <div className="week-nav-actions">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="btn btn-secondary week-step-btn"
              aria-label="Previous week"
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span>Previous week</span>
            </button>
            <button
              type="button"
              onClick={handleThisWeek}
              className="btn btn-secondary week-this-week-btn"
            >
              This week
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="btn btn-secondary week-step-btn"
              aria-label="Next week"
            >
              <span>Next week</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="week-range-label">
            <h2 className="week-range-text">
              {formatISTWeekLabel(weekDays[0], weekDays[6])}
            </h2>
          </div>
        </section>
      )}

      {viewMode === 'list' && (
        <section className="card list-view-nav-card" aria-label="List Navigation">
          <div className="list-toggle-row">
            <button
              type="button"
              onClick={() => setShowPastList(false)}
              className={`btn btn-secondary list-filter-btn ${
                !showPastList ? 'list-filter-active' : ''
              }`}
            >
              Upcoming bookings
            </button>
            <button
              type="button"
              onClick={() => setShowPastList(true)}
              className={`btn btn-secondary list-filter-btn ${
                showPastList ? 'list-filter-active' : ''
              }`}
            >
              Show past (last 30 days)
            </button>
          </div>
          <span className="list-mode-desc">
            {showPastList
              ? 'Showing past bookings from the last 30 days'
              : 'Showing upcoming bookings from today onward'}
          </span>
        </section>
      )}

      {/* 5. Universal Filter Panel */}
      <FilterPanel
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        filterSource={filterSource}
        onSourceChange={setFilterSource}
        filterDoctor={filterDoctor}
        onDoctorChange={setFilterDoctor}
        doctors={doctors}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showCancelled={showCancelled}
        onShowCancelledChange={setShowCancelled}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={handleClearFilters}
        statusOptions={STATUS_OPTIONS}
      />

      {/* 6. Total Bookings Divider Row (for Day & List views) */}
      {viewMode !== 'week' && (
        <div className="bookings-count-divider-row">
          <span className="bookings-count-label">{totalBookingsText}</span>
          <div className="count-hairline" />
        </div>
      )}

      {/* 7. Main Content Area */}
      <main className="appointments-content">
        {/* Loading Skeletons */}
        {loading && (
          <div className="bookings-skeleton-list" aria-busy="true" aria-label="Loading appointments">
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

        {/* Day View Closure Notice */}
        {viewMode === 'day' && !loading && !error && (
          <ClosureNotice dateStr={selectedDate} compact={true} />
        )}

        {/* Empty States for Day View */}
        {!loading && !error && appointments.length === 0 && viewMode === 'day' && isSunday && (
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

        {!loading && !error && appointments.length === 0 && viewMode === 'day' && !isSunday && (
          <div className="card empty-bookings-card" role="status">
            <div className="empty-icon-tile">
              <CalendarCheck size={32} className="empty-tile-icon" aria-hidden="true" />
            </div>
            <h3 className="empty-title">No bookings for this day</h3>
            <p className="empty-subtitle">
              There are no appointments scheduled for {formattedDateLabel}.
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

        {/* Empty Filter State (Appointments exist but filtered out) */}
        {!loading &&
          !error &&
          appointments.length > 0 &&
          filteredAppointments.length === 0 && (
            <div className="card empty-filter-card" role="status">
              <p className="empty-filter-title">No appointments match your filters</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn btn-secondary btn-clear-filter"
              >
                Clear filters
              </button>
            </div>
          )}

        {/* 1. Day View Content */}
        {!loading && !error && filteredAppointments.length > 0 && viewMode === 'day' && (
          <div className="bookings-cards-container">
            {dayGroupedByDoctor ? (
              // Multiple doctors: grouped with headings
              Object.entries(dayGroupedByDoctor).map(([docId, docAppts]) => {
                const docName = doctors[docId] || 'Doctor'
                const formattedDoctor = formatDoctorName(docName)

                return (
                  <section key={docId} className="doctor-bookings-group">
                    <div className="doctor-group-header">
                      <h3 className="doctor-group-title">{formattedDoctor}</h3>
                      <span className="doctor-group-count">
                        {docAppts.length} {docAppts.length === 1 ? 'booking' : 'bookings'}
                      </span>
                    </div>

                    <div className="bookings-cards-list">
                      {docAppts.map((appt) => {
                        const isNextUp = isTodaySelected && appt.id === nextUpApptId
                        const isPastUnfinished =
                          isTodaySelected &&
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
              // Single doctor: direct list without doctor heading
              <div className="bookings-cards-list">
                {filteredAppointments.map((appt) => {
                  const docName = doctors[appt.doctor_id] || 'Doctor'
                  const isNextUp = isTodaySelected && appt.id === nextUpApptId
                  const isPastUnfinished =
                    isTodaySelected &&
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

        {/* 2. Week View Content */}
        {!loading && !error && viewMode === 'week' && (
          <WeekBoard
            weekDays={weekDays}
            weekGroupedByDay={weekGroupedByDay}
            todayIST={todayIST}
            onSelectDay={(dayKey) => {
              setSelectedDate(dayKey)
              handleViewModeChange('day')
            }}
          />
        )}

        {/* 3. List View Content */}
        {!loading && !error && filteredAppointments.length > 0 && viewMode === 'list' && (
          <div className="list-view-container">
            {Object.keys(listGroupedByDate).map((dateKey) => {
              const dateBookings = listGroupedByDate[dateKey] || []
              const dateLabel = formatISTDateLabel(dateKey)
              const isToday = dateKey === todayIST

              return (
                <section key={dateKey} className="list-date-section">
                  <header className="list-sticky-date-header">
                    <h3 className="list-date-heading">
                      {dateLabel}
                      {isToday && (
                        <span className="today-badge-pill list-today-pill">
                          <span className="today-dot" aria-hidden="true" />
                          TODAY
                        </span>
                      )}
                    </h3>
                    <span className="list-date-count">
                      {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </header>

                  <div className="list-rows-group">
                    {dateBookings.map((appt) => (
                      <AppointmentRow
                        key={appt.id}
                        appointment={appt}
                        doctorName={doctors[appt.doctor_id] || 'Doctor'}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>

      {/* New Booking Modal */}
      {showNewBooking && (
        <NewBookingModal
          isOpen={showNewBooking}
          onClose={() => setShowNewBooking(false)}
          onSuccess={handleNewBookingSuccess}
          initialDate={viewMode === 'day' ? selectedDate : undefined}
        />
      )}
    </div>
  )
}
