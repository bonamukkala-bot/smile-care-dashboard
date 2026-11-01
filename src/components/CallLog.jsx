import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  formatDuration,
  getPatientNumber,
  maskPhone,
  getOutcome,
  hasOpenAttention,
  getISTDateKey,
  formatVariableValue,
} from '../lib/helpers'

export default function CallLog() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filter states
  const [selectedDate, setSelectedDate] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let isMounted = true

    async function fetchCallsData() {
      try {
        // 1. Fetch latest 200 calls without raw_payload
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

        // 2. Fetch open attention items and appointments for these call_ids in parallel
        const [attentionRes, appointmentsRes] = await Promise.all([
          supabase
            .from('attention_items')
            .select('call_id, type, status')
            .in('call_id', callIds)
            .eq('status', 'open'),
          supabase
            .from('appointments')
            .select('call_id, patient_name, slot_start, status')
            .in('call_id', callIds),
        ])

        if (!isMounted) return
        if (attentionRes.error) throw attentionRes.error
        if (appointmentsRes.error) throw appointmentsRes.error

        // 3. Map attention items and appointments by call_id
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

        // 4. Join data in JavaScript
        const joinedCalls = callsData.map((call) => ({
          ...call,
          attentionItems: attentionMap[call.call_id] || [],
          appointment: appointmentMap[call.call_id] || null,
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

    return () => {
      isMounted = false
    }
  }, [reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((prev) => prev + 1)
  }

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

      // 3. Search filter
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
  }, [calls, selectedDate, flaggedOnly, searchQuery])

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/" className="btn btn-back">
          ← Back
        </Link>
        <h1 className="page-heading">Call Log</h1>
      </header>

      {/* Filters bar */}
      <section className="card filters-card" aria-label="Call Filters">
        <div className="filter-group date-filter-group">
          <label htmlFor="date-picker" className="filter-label">
            Filter by Date
          </label>
          <div className="date-input-row">
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="filter-input date-input"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="btn btn-secondary filter-btn"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="filter-group toggle-filter-group">
          <label className="filter-label">Needs Attention</label>
          <button
            type="button"
            onClick={() => setFlaggedOnly((prev) => !prev)}
            className={`btn toggle-btn ${flaggedOnly ? 'toggle-active' : ''}`}
            aria-pressed={flaggedOnly}
          >
            {flaggedOnly ? '🚩 Flagged only (On)' : 'Flagged only'}
          </button>
        </div>

        <div className="filter-group search-filter-group">
          <label htmlFor="search-input" className="filter-label">
            Search Caller or Phone
          </label>
          <input
            id="search-input"
            type="text"
            placeholder="Search by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-input search-input"
          />
        </div>
      </section>

      {/* Main Content */}
      <main className="call-list-section">
        {loading && (
          <div className="loading-card">
            <div className="spinner" aria-hidden="true" />
            <p className="loading-text">Loading calls...</p>
          </div>
        )}

        {!loading && error && (
          <div className="card error-card">
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

        {!loading && !error && filteredCalls.length === 0 && (
          <div className="card empty-card">
            <p className="empty-title">No calls found</p>
            <p className="empty-subtitle">
              {calls.length === 0
                ? 'There are no recorded calls at this time.'
                : 'Try adjusting your date, search, or flag filters.'}
            </p>
          </div>
        )}

        {!loading && !error && filteredCalls.length > 0 && (
          <div className="call-list">
            {filteredCalls.map((call) => {
              const fullPhone = getPatientNumber(call)
              const maskedNumber = maskPhone(fullPhone)
              const callerName = call.variables?.full_name
                ? String(call.variables.full_name)
                : 'Unknown caller'
              const formattedTime = formatIST(call.started_at)
              const durationText = formatDuration(call.duration_seconds)
              const languageText = formatVariableValue(call.variables?.call_language)
              const outcome = getOutcome(call, call.appointment, call.attentionItems)
              const hasFlag = hasOpenAttention(call.attentionItems)

              return (
                <Link
                  key={call.call_id}
                  to={`/calls/${call.call_id}`}
                  className="card call-card"
                >
                  <div className="call-card-top">
                    <span className="call-time">{formattedTime}</span>
                    {hasFlag && (
                      <span className="badge flag-badge">
                        Needs attention
                      </span>
                    )}
                  </div>

                  <div className="call-card-main">
                    <h2 className="caller-name">{callerName}</h2>
                    <span className="masked-phone">{maskedNumber}</span>
                  </div>

                  <div className="call-card-bottom">
                    <div className="call-meta-item">
                      <span className="meta-label">Duration:</span>
                      <span className="meta-value">{durationText}</span>
                    </div>
                    <div className="call-meta-item">
                      <span className="meta-label">Language:</span>
                      <span className="meta-value">{languageText}</span>
                    </div>
                    <div className="call-meta-item">
                      <span
                        className={`badge outcome-badge outcome-${outcome.color}`}
                      >
                        {outcome.label}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
