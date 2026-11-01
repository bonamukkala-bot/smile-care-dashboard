import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  getPatientNumber,
  maskPhone,
  formatAttentionType,
  formatWaitTime,
  isOpenOver24Hours,
  formatSummary,
} from '../lib/helpers'

export default function NeedsAttention({ currentUserId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Resolution inline state
  const [activeResolvingId, setActiveResolvingId] = useState(null)
  const [resolveNote, setResolveNote] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [saveErrors, setSaveErrors] = useState({})

  // Recently resolved section
  const [showResolved, setShowResolved] = useState(false)
  const [resolvedItems, setResolvedItems] = useState([])
  const [loadingResolved, setLoadingResolved] = useState(false)
  const [resolvedError, setResolvedError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadOpenAttentionItems() {
      try {
        // 1. Fetch all OPEN attention items
        const { data: openData, error: openError } = await supabase
          .from('attention_items')
          .select('id, call_id, type, status, note, resolved_by, resolved_at, created_at')
          .eq('status', 'open')

        if (!isMounted) return
        if (openError) throw openError

        if (!openData || openData.length === 0) {
          setItems([])
          setLoading(false)
          return
        }

        // 2. Fetch calls for these call_ids
        const callIds = [...new Set(openData.map((item) => item.call_id).filter(Boolean))]

        let callMap = {}
        if (callIds.length > 0) {
          const { data: callsData, error: callsError } = await supabase
            .from('calls')
            .select(
              'call_id, patient_number, direction, from_number, to_number, started_at, summary, variables'
            )
            .in('call_id', callIds)

          if (!isMounted) return
          if (callsError) throw callsError

          for (const call of callsData || []) {
            callMap[call.call_id] = call
          }
        }

        // 3. Join in JavaScript
        const joined = openData.map((item) => ({
          ...item,
          call: callMap[item.call_id] || null,
        }))

        setItems(joined)
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load attention items:', err.message || err)
        setError('Unable to load attention items. Please try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadOpenAttentionItems()

    // Refresh open list automatically every 60 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        loadOpenAttentionItems()
      }
    }, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [reloadKey])

  // Split and sort: emergencies first, then others; oldest first in each
  const { emergencies, others } = useMemo(() => {
    const emList = []
    const otList = []

    for (const item of items) {
      if (item.type === 'emergency') {
        emList.push(item)
      } else {
        otList.push(item)
      }
    }

    emList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    otList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    return { emergencies: emList, others: otList }
  }, [items])

  // Handle Mark Resolved button click
  const handleStartResolve = (itemId) => {
    setActiveResolvingId(itemId)
    setResolveNote('')
    setSaveErrors((prev) => ({ ...prev, [itemId]: null }))
  }

  const handleCancelResolve = () => {
    setActiveResolvingId(null)
    setResolveNote('')
  }

  // Handle Confirm Resolved
  const handleConfirmResolve = async (item) => {
    setSavingId(item.id)
    setSaveErrors((prev) => ({ ...prev, [item.id]: null }))

    try {
      // Determine user id
      let userId = currentUserId
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser()
        userId = authData?.user?.id || null
      }

      const { data, error: updateError } = await supabase
        .from('attention_items')
        .update({
          status: 'resolved',
          note: resolveNote.trim() || null,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('status', 'open')
        .select()

      if (updateError || !data || data.length !== 1) {
        setSaveErrors((prev) => ({
          ...prev,
          [item.id]: 'Could not save. Please try again.',
        }))
      } else {
        // Success: remove item from local list without reload
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setActiveResolvingId(null)
        setResolveNote('')
      }
    } catch {
      setSaveErrors((prev) => ({
        ...prev,
        [item.id]: 'Could not save. Please try again.',
      }))
    } finally {
      setSavingId(null)
    }
  }

  // Handle Recently Resolved toggle & fetch
  const handleToggleResolved = async () => {
    if (showResolved) {
      setShowResolved(false)
      return
    }

    setShowResolved(true)
    setLoadingResolved(true)
    setResolvedError(null)

    try {
      // 1. Fetch latest 20 resolved items
      const { data: resData, error: resError } = await supabase
        .from('attention_items')
        .select('id, call_id, type, status, note, resolved_by, resolved_at, created_at')
        .eq('status', 'resolved')
        .order('resolved_at', { ascending: false })
        .limit(20)

      if (resError) throw resError

      if (!resData || resData.length === 0) {
        setResolvedItems([])
        setLoadingResolved(false)
        return
      }

      // 2. Fetch calls
      const callIds = [...new Set(resData.map((i) => i.call_id).filter(Boolean))]
      let callMap = {}
      if (callIds.length > 0) {
        const { data: callsData } = await supabase
          .from('calls')
          .select('call_id, variables')
          .in('call_id', callIds)

        for (const call of callsData || []) {
          callMap[call.call_id] = call
        }
      }

      // 3. Fetch staff profiles for resolved_by
      const userIds = [...new Set(resData.map((i) => i.resolved_by).filter(Boolean))]
      let staffMap = {}
      if (userIds.length > 0) {
        const { data: staffData } = await supabase
          .from('staff_profiles')
          .select('user_id, full_name')
          .in('user_id', userIds)

        for (const staff of staffData || []) {
          staffMap[staff.user_id] = staff.full_name
        }
      }

      const joinedResolved = resData.map((item) => ({
        ...item,
        callerName: callMap[item.call_id]?.variables?.full_name || 'Unknown caller',
        resolverName: (item.resolved_by && staffMap[item.resolved_by]) || 'Staff',
      }))

      setResolvedItems(joinedResolved)
    } catch (err) {
      console.error('Failed to load resolved items:', err.message || err)
      setResolvedError('Unable to load recently resolved items.')
    } finally {
      setLoadingResolved(false)
    }
  }

  const renderItemCard = (item, isEmergency = false) => {
    const call = item.call
    const callerName = call?.variables?.full_name
      ? String(call.variables.full_name)
      : 'Unknown caller'
    const fullPhone = getPatientNumber(call)
    const maskedPhone = maskPhone(fullPhone)
    const summaryText = formatSummary(call?.summary)
    const callTimeIST = formatIST(call?.started_at)
    const waitTimeText = formatWaitTime(item.created_at)
    const isOver24H = isOpenOver24Hours(item.created_at)
    const typeLabel = formatAttentionType(item.type)
    const isResolving = activeResolvingId === item.id
    const isSaving = savingId === item.id
    const saveError = saveErrors[item.id]

    return (
      <article
        key={item.id}
        className={`card attention-card ${isEmergency ? 'emergency-card' : ''}`}
      >
        <div className="attention-card-header">
          <span
            className={`badge attention-type-badge ${
              isEmergency ? 'type-badge-emergency' : 'type-badge-other'
            }`}
          >
            {typeLabel}
          </span>
          <span className="wait-time-tag">{waitTimeText}</span>
        </div>

        <div className="attention-card-body">
          <div className="attention-caller-row">
            <h3 className="attention-caller-name">{callerName}</h3>
            <span className="attention-phone">{maskedPhone}</span>
          </div>

          <p className="attention-summary">
            <span className="summary-label">Summary: </span>
            {summaryText}
          </p>

          <div className="attention-meta-row">
            <span className="call-time-meta">Call time: {callTimeIST}</span>
          </div>

          {isOver24H && (
            <div className="warning-banner" role="alert">
              ⚠️ Open for more than 24 hours - please handle
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="attention-card-actions">
          <Link
            to={`/calls/${item.call_id}`}
            className="btn btn-secondary btn-open-call"
          >
            Open call
          </Link>

          {!isResolving && (
            <button
              type="button"
              onClick={() => handleStartResolve(item.id)}
              className="btn btn-primary btn-resolve"
            >
              Mark resolved
            </button>
          )}
        </div>

        {/* Inline Resolve Form */}
        {isResolving && (
          <div className="resolve-form-box">
            <label htmlFor={`note-${item.id}`} className="resolve-label">
              Note (optional)
            </label>
            <textarea
              id={`note-${item.id}`}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="e.g. Called back and rescheduled for Tuesday"
              className="resolve-textarea"
              disabled={isSaving}
              rows={3}
            />

            {saveError && (
              <p className="resolve-error-text" role="alert">
                {saveError}
              </p>
            )}

            <div className="resolve-btn-row">
              <button
                type="button"
                onClick={() => handleConfirmResolve(item)}
                disabled={isSaving}
                className="btn btn-primary btn-confirm-resolve"
              >
                {isSaving ? 'Saving...' : 'Confirm resolved'}
              </button>
              <button
                type="button"
                onClick={handleCancelResolve}
                disabled={isSaving}
                className="btn btn-secondary btn-cancel-resolve"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/" className="btn btn-back">
          ← Back
        </Link>
        <h1 className="page-heading">Needs Attention</h1>
      </header>

      {loading && (
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Loading items that need attention...</p>
        </div>
      )}

      {!loading && error && (
        <div className="card error-card">
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

      {!loading && !error && items.length === 0 && (
        <div className="card all-clear-card">
          <div className="all-clear-icon">✓</div>
          <h2 className="all-clear-title">All clear - nothing needs attention</h2>
          <p className="all-clear-subtitle">
            All calls and patient inquiries have been handled.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <main className="attention-sections-container">
          {/* Emergency Section */}
          {emergencies.length > 0 && (
            <section className="emergency-group-section">
              <div className="emergency-section-header">
                <h2 className="emergency-title">🚨 Emergencies</h2>
                <span className="emergency-count-badge">
                  {emergencies.length}
                </span>
              </div>
              <div className="attention-card-list">
                {emergencies.map((item) => renderItemCard(item, true))}
              </div>
            </section>
          )}

          {/* Other Items Section */}
          {others.length > 0 && (
            <section className="others-group-section">
              <h2 className="section-title">Other items to check</h2>
              <div className="attention-card-list">
                {others.map((item) => renderItemCard(item, false))}
              </div>
            </section>
          )}
        </main>
      )}

      {/* Recently Resolved Section */}
      <section className="recently-resolved-wrapper">
        <button
          type="button"
          onClick={handleToggleResolved}
          className="btn btn-secondary btn-toggle-resolved"
        >
          {showResolved ? 'Hide resolved' : 'Show recently resolved'}
        </button>

        {showResolved && (
          <div className="resolved-panel">
            <h3 className="resolved-panel-title">Recently Resolved (Latest 20)</h3>

            {loadingResolved && (
              <p className="loading-resolved-text">Loading resolved items...</p>
            )}

            {resolvedError && (
              <p className="error-text">{resolvedError}</p>
            )}

            {!loadingResolved && !resolvedError && resolvedItems.length === 0 && (
              <p className="empty-resolved-text">No resolved items found.</p>
            )}

            {!loadingResolved && !resolvedError && resolvedItems.length > 0 && (
              <div className="resolved-cards-grid">
                {resolvedItems.map((item) => (
                  <div key={item.id} className="card resolved-mini-card">
                    <div className="resolved-mini-top">
                      <span className="badge resolved-type-badge">
                        {formatAttentionType(item.type)}
                      </span>
                      <span className="resolved-time">
                        {formatIST(item.resolved_at)}
                      </span>
                    </div>

                    <div className="resolved-mini-caller">
                      <strong>{item.callerName}</strong>
                    </div>

                    <div className="resolved-mini-meta">
                      Resolved by: <strong>{item.resolverName}</strong>
                    </div>

                    {item.note && (
                      <p className="resolved-mini-note">
                        <em>Note: {item.note}</em>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

