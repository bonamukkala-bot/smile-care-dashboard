import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, ChevronUp, AlertCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AttentionFilters from './AttentionFilters'
import AttentionCard from './AttentionCard'
import { formatTimeAgo, formatAttentionType } from '../lib/helpers'

export default function NeedsAttention({ currentUserId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())

  // Filtering & Search
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | typeKey
  const [searchQuery, setSearchQuery] = useState('')

  // Resolve Panel & State per item
  const [activeResolvingId, setActiveResolvingId] = useState(null)
  const [resolveNotes, setResolveNotes] = useState({}) // { [itemId]: string }
  const [savingId, setSavingId] = useState(null)
  const [saveErrors, setSaveErrors] = useState({})
  const [fadingItemIds, setFadingItemIds] = useState(new Set())

  // Toast notification state
  const [toastMessage, setToastMessage] = useState(null)
  const toastTimerRef = useRef(null)

  // Textarea ref to focus on keyboard shortcut 'R'
  const activeTextareaRef = useRef(null)

  // Recently resolved section
  const [resolvedCount, setResolvedCount] = useState(0)
  const [showResolved, setShowResolved] = useState(false)
  const [resolvedItems, setResolvedItems] = useState([])
  const [loadingResolved, setLoadingResolved] = useState(false)
  const [resolvedError, setResolvedError] = useState(null)

  // 1. Fetch lightweight resolved count on mount and reload
  useEffect(() => {
    let isMounted = true
    supabase
      .from('attention_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .then(({ count, error: countErr }) => {
        if (isMounted && !countErr && typeof count === 'number') {
          setResolvedCount(count)
        }
      })
    return () => {
      isMounted = false
    }
  }, [reloadKey])

  // 2. Fetch Open Attention Items & Join Calls
  useEffect(() => {
    let isMounted = true

    async function loadOpenAttentionItems() {
      try {
        const { data: openData, error: openError } = await supabase
          .from('attention_items')
          .select('id, call_id, type, status, note, resolved_by, resolved_at, created_at')
          .eq('status', 'open')

        if (!isMounted) return
        if (openError) throw openError

        setLastRefreshedAt(new Date())

        if (!openData || openData.length === 0) {
          setItems([])
          setLoading(false)
          return
        }

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

        const joined = openData.map((item) => ({
          ...item,
          call: callMap[item.call_id] || null,
        }))

        setItems(joined)
        setError(null)
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load attention items:', err.message || err)
        setError('Unable to load attention items. Please check your connection.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadOpenAttentionItems()

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

  // Calculate dynamic type counts over all open items
  const typeCounts = useMemo(() => {
    const counts = {}
    for (const item of items) {
      counts[item.type] = (counts[item.type] || 0) + 1
    }
    return counts
  }, [items])

  // Fallback to 'all' if selected type is no longer present in typeCounts
  const effectiveFilter =
    activeFilter !== 'all' && (!typeCounts[activeFilter] || typeCounts[activeFilter] === 0)
      ? 'all'
      : activeFilter

  // Split items into Emergencies and Others (oldest first within each)
  const { allEmergencies, allOthers } = useMemo(() => {
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

    return { allEmergencies: emList, allOthers: otList }
  }, [items])

  const hasAnyEmergency = allEmergencies.length > 0
  const totalOpenCount = items.length

  // Filter items based on effectiveFilter and searchQuery
  const filterList = useCallback(
    (list) => {
      let filtered = list
      if (effectiveFilter !== 'all') {
        filtered = filtered.filter((item) => item.type === effectiveFilter)
      }

      const q = searchQuery.trim().toLowerCase()
      if (q) {
        const searchDigits = q.replace(/\D/g, '')
        filtered = filtered.filter((item) => {
          const call = item.call
          const name = (call?.variables?.full_name || '').toLowerCase()
          if (name.includes(q)) return true

          const summary = (call?.summary || '').toLowerCase()
          if (summary.includes(q)) return true

          const note = (item.note || '').toLowerCase()
          if (note.includes(q)) return true

          if (searchDigits) {
            const rawPhone = (call?.patient_number || call?.from_number || '').replace(/\D/g, '')
            if (rawPhone.includes(searchDigits)) return true
          }
          return false
        })
      }
      return filtered
    },
    [effectiveFilter, searchQuery]
  )

  const visibleEmergencies = useMemo(() => filterList(allEmergencies), [filterList, allEmergencies])
  const visibleOthers = useMemo(() => filterList(allOthers), [filterList, allOthers])
  const allVisible = useMemo(
    () => [...visibleEmergencies, ...visibleOthers],
    [visibleEmergencies, visibleOthers]
  )

  // Show toast notification
  const triggerToast = (msg) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Handle Mark Resolved click
  const handleStartResolve = (itemId) => {
    setActiveResolvingId(itemId)
    setSaveErrors((prev) => ({ ...prev, [itemId]: null }))
    // Focus textarea on next render
    setTimeout(() => {
      activeTextareaRef.current?.focus()
    }, 50)
  }

  const handleCancelResolve = () => {
    setActiveResolvingId(null)
  }

  const handleNoteChange = (itemId, text) => {
    setResolveNotes((prev) => ({ ...prev, [itemId]: text }))
    setSaveErrors((prev) => ({ ...prev, [itemId]: null }))
  }

  // Handle Confirm Resolved
  const handleConfirmResolve = async (item) => {
    const noteText = (resolveNotes[item.id] || '').trim()
    if (!noteText) {
      setSaveErrors((prev) => ({
        ...prev,
        [item.id]: 'Please enter a resolution note.',
      }))
      activeTextareaRef.current?.focus()
      return
    }

    setSavingId(item.id)
    setSaveErrors((prev) => ({ ...prev, [item.id]: null }))

    try {
      let userId = currentUserId
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser()
        userId = authData?.user?.id || null
      }

      const { data, error: updateError } = await supabase
        .from('attention_items')
        .update({
          status: 'resolved',
          note: noteText,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('status', 'open')
        .select()

      if (updateError || !data || data.length !== 1) {
        setSaveErrors((prev) => ({
          ...prev,
          [item.id]: 'Could not save resolution. Please try again.',
        }))
      } else {
        // Trigger fade out
        setFadingItemIds((prev) => new Set([...prev, item.id]))

        setTimeout(() => {
          // Remove from local items
          setItems((prev) => prev.filter((i) => i.id !== item.id))
          setFadingItemIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          setActiveResolvingId(null)
          setResolveNotes((prev) => {
            const next = { ...prev }
            delete next[item.id]
            return next
          })
          setResolvedCount((prev) => prev + 1)
        }, 300)

        triggerToast('Marked as resolved')

        // Dispatch live event so AppShell/Sidebar/TopBar re-fetch counts immediately
        window.dispatchEvent(new CustomEvent('attention-changed'))
      }
    } catch {
      setSaveErrors((prev) => ({
        ...prev,
        [item.id]: 'Could not save resolution. Please try again.',
      }))
    } finally {
      setSavingId(null)
    }
  }

  // Keyboard shortcut listener for 'r' / 'Escape'
  useEffect(() => {
    function handleKeyDown(e) {
      // Ignore if typing in an input, textarea, select, or contenteditable
      const target = e.target
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (e.key === 'Escape') {
        if (activeResolvingId !== null) {
          setActiveResolvingId(null)
        }
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        if (isInput) return
        if (e.ctrlKey || e.altKey || e.metaKey) return
        if (activeResolvingId !== null) return // Already open

        // Open resolve panel on the first visible card
        if (allVisible.length > 0) {
          e.preventDefault()
          const firstItem = allVisible[0]
          handleStartResolve(firstItem.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [allVisible, activeResolvingId])

  // Lazy-load Recently Resolved items
  const handleToggleResolved = async () => {
    if (showResolved) {
      setShowResolved(false)
      return
    }

    setShowResolved(true)
    setLoadingResolved(true)
    setResolvedError(null)

    try {
      const { data: resData, error: resError } = await supabase
        .from('attention_items')
        .select('id, call_id, type, status, note, resolved_at, created_at')
        .eq('status', 'resolved')
        .order('resolved_at', { ascending: false })
        .limit(20)

      if (resError) throw resError

      if (!resData || resData.length === 0) {
        setResolvedItems([])
        setLoadingResolved(false)
        return
      }

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

      const joined = resData.map((item) => ({
        ...item,
        callerName: callMap[item.call_id]?.variables?.full_name || 'Unknown caller',
      }))

      setResolvedItems(joined)
    } catch (err) {
      console.error('Failed to load resolved items:', err)
      setResolvedError('Unable to load recently resolved items.')
    } finally {
      setLoadingResolved(false)
    }
  }

  return (
    <div className="needs-attention-screen">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="attention-toast-notice" role="status" aria-live="polite">
          <CheckCircle2 size={18} className="toast-check-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Top Header Row */}
      <header className="page-header attention-header-row">
        <div className="header-left-group">
          <Link to="/" className="btn btn-back">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <div className="attention-title-wrap">
            <h1 className="page-heading">Needs Attention</h1>
            <span
              className={`attention-count-badge ${
                hasAnyEmergency ? 'badge-emergency' : 'badge-attention'
              }`}
              aria-label={`${totalOpenCount} open attention items`}
            >
              {totalOpenCount}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Search & Filter Controls */}
      <AttentionFilters
        totalOpenCount={totalOpenCount}
        typeCounts={typeCounts}
        activeFilter={effectiveFilter}
        onSelectFilter={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        lastRefreshedAt={lastRefreshedAt}
      />

      {/* Loading Skeletons */}
      {loading && (
        <div className="attention-skeletons" aria-busy="true" aria-label="Loading attention items">
          <div className="skeleton-card skeleton-triage-card" />
          <div className="skeleton-card skeleton-triage-card" />
          <div className="skeleton-card skeleton-triage-card" />
        </div>
      )}

      {/* Fetch Error */}
      {!loading && error && (
        <div className="card error-card" role="alert">
          <AlertCircle size={28} className="error-icon" />
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

      {/* Empty State: All Clear (No items in database) */}
      {!loading && !error && totalOpenCount === 0 && (
        <div className="card attention-all-clear-card" role="status">
          <div className="all-clear-icon-wrap">
            <CheckCircle2 size={36} className="all-clear-check-icon" />
          </div>
          <h2 className="all-clear-heading">All clear</h2>
          <p className="all-clear-subtext">Nothing needs attention right now.</p>
        </div>
      )}

      {/* Empty State: Filter/Search matched 0 */}
      {!loading && !error && totalOpenCount > 0 && allVisible.length === 0 && (
        <div className="card attention-no-results-card">
          <p className="no-results-text">No items match your search</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setActiveFilter('all')
            }}
            className="btn btn-secondary btn-sm mt-8"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* 3. Triage Sections */}
      {!loading && !error && allVisible.length > 0 && (
        <main className="attention-cards-container">
          {/* Section A: Emergencies */}
          {visibleEmergencies.length > 0 && (
            <section className="triage-section emergency-triage-section">
              <div className="section-rule-header">
                <span className="emergency-rule-title">EMERGENCY - CALL BACK NOW</span>
                <div className="hairline-rule hairline-emergency" />
              </div>

              <div className="cards-stack">
                {visibleEmergencies.map((item, index) => (
                  <AttentionCard
                    key={item.id}
                    item={item}
                    isFirstCard={index === 0}
                    isResolving={activeResolvingId === item.id}
                    resolveNote={resolveNotes[item.id] || ''}
                    onNoteChange={(txt) => handleNoteChange(item.id, txt)}
                    onStartResolve={() => handleStartResolve(item.id)}
                    onCancelResolve={handleCancelResolve}
                    onConfirmResolve={() => handleConfirmResolve(item)}
                    isSaving={savingId === item.id}
                    saveError={saveErrors[item.id]}
                    textareaRef={activeResolvingId === item.id ? activeTextareaRef : null}
                    isFadingOut={fadingItemIds.has(item.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section B: Other Items */}
          {visibleOthers.length > 0 && (
            <section className="triage-section others-triage-section">
              <div className="section-rule-header">
                <span className="others-rule-title">
                  {visibleEmergencies.length > 0 ? 'OTHER ITEMS TO CHECK' : 'OPEN ITEMS'}
                </span>
                <div className="hairline-rule" />
              </div>

              <div className="cards-stack">
                {visibleOthers.map((item, index) => (
                  <AttentionCard
                    key={item.id}
                    item={item}
                    isFirstCard={visibleEmergencies.length === 0 && index === 0}
                    isResolving={activeResolvingId === item.id}
                    resolveNote={resolveNotes[item.id] || ''}
                    onNoteChange={(txt) => handleNoteChange(item.id, txt)}
                    onStartResolve={() => handleStartResolve(item.id)}
                    onCancelResolve={handleCancelResolve}
                    onConfirmResolve={() => handleConfirmResolve(item)}
                    isSaving={savingId === item.id}
                    saveError={saveErrors[item.id]}
                    textareaRef={activeResolvingId === item.id ? activeTextareaRef : null}
                    isFadingOut={fadingItemIds.has(item.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {/* 4. Collapsible Recently Resolved Section */}
      <section className="recently-resolved-section">
        <button
          type="button"
          onClick={handleToggleResolved}
          className="btn-toggle-recently-resolved"
          aria-expanded={showResolved}
          aria-controls="recently-resolved-content"
        >
          <div className="resolved-button-title">
            <span>Recently resolved</span>
            <span className="resolved-counter-pill">{resolvedCount}</span>
          </div>
          {showResolved ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showResolved && (
          <div id="recently-resolved-content" className="recently-resolved-tray">
            {loadingResolved && (
              <p className="tray-status-text">Loading resolved items...</p>
            )}

            {resolvedError && (
              <p className="tray-status-text error-text">{resolvedError}</p>
            )}

            {!loadingResolved && !resolvedError && resolvedItems.length === 0 && (
              <p className="tray-status-text">No resolved items yet.</p>
            )}

            {!loadingResolved && !resolvedError && resolvedItems.length > 0 && (
              <div className="resolved-rows-list">
                {resolvedItems.map((item) => (
                  <article key={item.id} className="resolved-row-item">
                    <div className="resolved-row-header">
                      <span className="badge resolved-row-badge">
                        {formatAttentionType(item.type)}
                      </span>
                      <strong className="resolved-caller-name">{item.callerName}</strong>
                      <span className="resolved-time-ago">
                        Resolved {formatTimeAgo(item.resolved_at)}
                      </span>
                    </div>

                    {item.note && (
                      <p className="resolved-row-note">{item.note}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
