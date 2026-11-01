import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PhoneCall, Phone, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getPatientNumber,
  getOutcome,
  hasOpenAttention,
  getISTDateKey,
} from '../lib/helpers'
import CallFilterPanel from './CallFilterPanel'
import CallCard from './CallCard'

const OUTCOME_OPTIONS = [
  'Emergency',
  'Booked',
  'Cancel request',
  'Reschedule request',
  'Call failed',
  'Hung up',
  'Info only',
]

function formatGroupDateHeader(dateKey) {
  if (!dateKey || dateKey === 'unknown') return 'Unknown Date'
  try {
    const d = new Date(`${dateKey}T12:00:00+05:30`)
    if (isNaN(d.getTime())) return dateKey
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return dateKey
  }
}

export default function CallLog() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filter states
  const [selectedDate, setSelectedDate] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState('all')
  const [selectedLanguage, setSelectedLanguage] = useState('all')
  const [selectedReviewStatus, setSelectedReviewStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let isMounted = true

    async function fetchCallsData() {
      try {
        // 1. Fetch latest 200 calls without raw_payload or full_conversation
        const { data: callsData, error: callsError } = await supabase
          .from('calls')
          .select(
            'call_id, direction, from_number, to_number, patient_number, started_at, duration_seconds, status, hangup_source, variables'
          )
          .order('started_at', { ascending: false })
          .limit(200)

        if (!isMounted) return
        if (callsError) throw callsError

        if (!callsData || callsData.length === 0) {
          setCalls([])
          setLoading(false)
          return
        }

        const callIds = callsData.map((c) => c.call_id)

        // 2. Fetch open attention items, appointments, and reviews in parallel
        const [attentionRes, appointmentsRes, reviewsRes] = await Promise.all([
          supabase
            .from('attention_items')
            .select('call_id, type, status')
            .in('call_id', callIds)
            .eq('status', 'open'),
          supabase
            .from('appointments')
            .select('call_id, patient_name, slot_start, status')
            .in('call_id', callIds),
          supabase
            .from('call_reviews')
            .select('call_id')
            .in('call_id', callIds),
        ])

        if (!isMounted) return
        if (attentionRes.error) throw attentionRes.error
        if (appointmentsRes.error) throw appointmentsRes.error
        if (reviewsRes.error) {
          console.error('Failed to load call reviews:', reviewsRes.error.message)
        }

        // 3. Map attention items, appointments, and reviews
        const attentionMap = {}
        for (const item of attentionRes.data || []) {
          if (!attentionMap[item.call_id]) {
            attentionMap[item.call_id] = []
          }
          attentionMap[item.call_id].push(item)
        }

        const appointmentMap = {}
        for (const appt of appointmentsRes.data || []) {
          appointmentMap[appt.call_id] = appt
        }

        const reviewedSet = new Set((reviewsRes.data || []).map((r) => r.call_id))

        // 4. Join data in JavaScript
        const joinedCalls = callsData.map((call) => ({
          ...call,
          attentionItems: attentionMap[call.call_id] || [],
          appointment: appointmentMap[call.call_id] || null,
          isReviewed: reviewedSet.has(call.call_id),
        }))

        setCalls(joinedCalls)
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load call log:', err.message || err)
        setError('Unable to load calls. Please check your connection and try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCallsData()

    // 60-second periodic refresh
    const interval = setInterval(fetchCallsData, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((prev) => prev + 1)
  }

  // Compute distinct languages from the loaded calls
  const distinctLanguages = useMemo(() => {
    const langSet = new Set()
    for (const call of calls) {
      const lang = call.variables?.call_language
      if (
        lang &&
        typeof lang === 'string' &&
        lang.trim() !== '' &&
        lang.toUpperCase() !== 'NA'
      ) {
        langSet.add(lang.trim())
      }
    }
    return Array.from(langSet).sort()
  }, [calls])

  // Clear all filters handler
  const handleClearAllFilters = () => {
    setSelectedDate('')
    setFlaggedOnly(false)
    setSelectedOutcome('all')
    setSelectedLanguage('all')
    setSelectedReviewStatus('all')
    setSearchQuery('')
  }

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedDate) count++
    if (flaggedOnly) count++
    if (selectedOutcome !== 'all') count++
    if (selectedLanguage !== 'all') count++
    if (selectedReviewStatus !== 'all') count++
    if (searchQuery.trim()) count++
    return count
  }, [
    selectedDate,
    flaggedOnly,
    selectedOutcome,
    selectedLanguage,
    selectedReviewStatus,
    searchQuery,
  ])

  const hasActiveFilters = activeFilterCount > 0

  // Filtered calls
  const filteredCalls = useMemo(() => {
    const trimmedSearch = searchQuery.trim()
    const searchLower = trimmedSearch.toLowerCase()
    const searchDigits = trimmedSearch.replace(/\D/g, '')

    return calls.filter((call) => {
      // 1. Date filter (IST)
      if (selectedDate) {
        const callISTDate = getISTDateKey(call.started_at)
        if (callISTDate !== selectedDate) {
          return false
        }
      }

      // 2. Flagged only filter
      if (flaggedOnly) {
        if (!hasOpenAttention(call.attentionItems)) {
          return false
        }
      }

      // 3. Outcome filter
      const outcome = getOutcome(call, call.appointment, call.attentionItems)
      if (selectedOutcome !== 'all' && outcome.label !== selectedOutcome) {
        return false
      }

      // 4. Language filter
      if (selectedLanguage !== 'all') {
        const callLang = (call.variables?.call_language || '').trim()
        if (callLang !== selectedLanguage) {
          return false
        }
      }

      // 5. Reviewed / Not reviewed filter
      if (selectedReviewStatus === 'reviewed' && !call.isReviewed) {
        return false
      }
      if (selectedReviewStatus === 'not_reviewed' && call.isReviewed) {
        return false
      }

      // 6. Search filter (Caller name OR phone digits)
      if (trimmedSearch) {
        const callerName = call.variables?.full_name
          ? String(call.variables.full_name)
          : 'Unknown caller'
        const matchesName = callerName.toLowerCase().includes(searchLower)

        const rawPhone = getPatientNumber(call)
        const phoneDigits = rawPhone.replace(/\D/g, '')
        const matchesPhone = searchDigits.length > 0 && phoneDigits.includes(searchDigits)

        if (!matchesName && !matchesPhone) {
          return false
        }
      }

      return true
    })
  }, [
    calls,
    selectedDate,
    flaggedOnly,
    selectedOutcome,
    selectedLanguage,
    selectedReviewStatus,
    searchQuery,
  ])

  // Group filtered calls by date for sticky headers
  const groupedCalls = useMemo(() => {
    const groups = []
    const groupMap = new Map()

    for (const call of filteredCalls) {
      const dateKey = getISTDateKey(call.started_at) || 'unknown'
      if (!groupMap.has(dateKey)) {
        const entry = { dateKey, calls: [] }
        groupMap.set(dateKey, entry)
        groups.push(entry)
      }
      groupMap.get(dateKey).calls.push(call)
    }

    return groups
  }, [filteredCalls])

  return (
    <div className="page-container call-log-screen">
      {/* Header Row: Back button, Title, Small call count */}
      <header className="call-log-header-row">
        <div className="call-log-header-left">
          <Link to="/" className="btn btn-secondary btn-header-back" title="Back to Home">
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Home</span>
          </Link>
          <div className="call-log-title-wrap">
            <h1 className="page-heading">Call Log</h1>
            {!loading && (
              <span className="call-count-badge">
                {hasActiveFilters
                  ? `${filteredCalls.length} of ${calls.length} calls`
                  : `${calls.length} calls`}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="btn btn-secondary btn-refresh-calls"
          title="Refresh call list"
          aria-label="Refresh calls"
        >
          <RefreshCw size={16} className={loading ? 'spinner-inline' : ''} aria-hidden="true" />
          <span className="desktop-only-inline">Refresh</span>
        </button>
      </header>

      {/* Filter Panel (collapsible on mobile, grid on desktop) */}
      <CallFilterPanel
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedOutcome={selectedOutcome}
        onOutcomeChange={setSelectedOutcome}
        outcomeOptions={OUTCOME_OPTIONS}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        distinctLanguages={distinctLanguages}
        selectedReviewStatus={selectedReviewStatus}
        onReviewStatusChange={setSelectedReviewStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        flaggedOnly={flaggedOnly}
        onFlaggedToggle={() => setFlaggedOnly((prev) => !prev)}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearAllFilters={handleClearAllFilters}
      />

      {/* Main Content Area */}
      <main className="call-log-main-content">
        {/* Loading Skeletons */}
        {loading && (
          <div className="call-list-skeletons" aria-label="Loading call list">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card skeleton-call-card pulse-skeleton" />
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card error-card" role="alert">
            <AlertCircle size={32} className="error-icon" aria-hidden="true" />
            <p className="error-text">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty States */}
        {!loading && !error && filteredCalls.length === 0 && (
          <div className="card empty-card" role="status">
            {calls.length === 0 ? (
              <>
                <div className="empty-icon-wrap">
                  <PhoneCall size={38} className="empty-icon-accent" aria-hidden="true" />
                </div>
                <h2 className="empty-title">No calls yet</h2>
                <p className="empty-subtitle">
                  No telephone calls have been recorded by the system yet.
                </p>
              </>
            ) : (
              <>
                <div className="empty-icon-wrap">
                  <Phone size={38} className="empty-icon-muted" aria-hidden="true" />
                </div>
                <h2 className="empty-title">No calls match your filters</h2>
                <p className="empty-subtitle">
                  Try clearing some filters or changing your search terms to see more calls.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="btn btn-secondary mt-16"
                >
                  Clear all filters
                </button>
              </>
            )}
          </div>
        )}

        {/* Grouped Call Cards with Sticky Date Headers */}
        {!loading && !error && filteredCalls.length > 0 && (
          <div className="call-groups-container">
            {groupedCalls.map((group) => {
              const formattedDateLabel = formatGroupDateHeader(group.dateKey)
              return (
                <section
                  key={group.dateKey}
                  className="call-date-group-section"
                  aria-labelledby={`heading-date-${group.dateKey}`}
                >
                  {/* Sticky Date Header */}
                  <div className="call-group-sticky-header">
                    <h2
                      id={`heading-date-${group.dateKey}`}
                      className="call-group-date-title"
                    >
                      {formattedDateLabel}
                    </h2>
                    <span className="call-group-count-pill">
                      {group.calls.length} {group.calls.length === 1 ? 'call' : 'calls'}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="call-cards-stack">
                    {group.calls.map((call) => (
                      <CallCard key={call.call_id} call={call} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
