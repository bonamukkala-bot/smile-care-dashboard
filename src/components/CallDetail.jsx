import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  formatISTTime,
  formatDuration,
  getPatientNumber,
  getOutcome,
  formatVariableValue,
  formatAttentionType,
} from '../lib/helpers'

export default function CallDetail({ currentUserId }) {
  const { callId } = useParams()
  const [resolvedUserId, setResolvedUserId] = useState(null)
  const userId = currentUserId || resolvedUserId
  const [call, setCall] = useState(null)
  const [turns, setTurns] = useState([])
  const [attentionItems, setAttentionItems] = useState([])
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Part A: Review state
  const [review, setReview] = useState(null)
  const [staffMap, setStaffMap] = useState({})
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [reviewError, setReviewError] = useState(null)

  // Part A: Issue reports state
  const [issueReports, setIssueReports] = useState([])
  const [isReportingOpen, setIsReportingOpen] = useState(false)
  const [issueReason, setIssueReason] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)
  const [issueError, setIssueError] = useState(null)
  const [issueSuccess, setIssueSuccess] = useState(null)

  // Part C: Audit log refs (guard against StrictMode double-running)
  const hasAuditedViewRef = useRef(false)
  const hasAuditedPlayRef = useRef(false)

  // Resolve user id if not provided via props
  useEffect(() => {
    if (currentUserId) return
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted && session?.user?.id) {
        setResolvedUserId(session.user.id)
      }
    })

    return () => {
      isMounted = false
    }
  }, [currentUserId])

  // Load call details
  useEffect(() => {
    let isMounted = true

    async function loadCallDetails() {
      if (!callId) return
      setLoading(true)
      setError(null)

      try {
        // Fetch call (WITHOUT raw_payload), turns, attention items, appointment, reviews, and issue reports
        const [
          callRes,
          turnsRes,
          attentionRes,
          appointmentRes,
          reviewRes,
          issuesRes,
        ] = await Promise.all([
          supabase
            .from('calls')
            .select(
              'call_id, direction, from_number, to_number, patient_number, started_at, duration_seconds, status, hangup_source, hangup_reason, recording_url, summary, sentiment, variables, received_at'
            )
            .eq('call_id', callId)
            .maybeSingle(),
          supabase
            .from('call_turns')
            .select('call_id, sequence, user_query, bot_response, turn_time')
            .eq('call_id', callId)
            .order('sequence', { ascending: true }),
          supabase
            .from('attention_items')
            .select('call_id, type, status')
            .eq('call_id', callId),
          supabase
            .from('appointments')
            .select('call_id, patient_name, slot_start, status')
            .eq('call_id', callId)
            .maybeSingle(),
          supabase
            .from('call_reviews')
            .select('call_id, reviewed_by, reviewed_at, note')
            .eq('call_id', callId)
            .maybeSingle(),
          supabase
            .from('issue_reports')
            .select('id, call_id, reported_by, reason, status, created_at')
            .eq('call_id', callId)
            .order('created_at', { ascending: false }),
        ])

        if (!isMounted) return

        if (callRes.error) throw callRes.error
        if (turnsRes.error) throw turnsRes.error
        if (attentionRes.error) throw attentionRes.error
        if (appointmentRes.error) throw appointmentRes.error

        if (!callRes.data) {
          setError('Call not found.')
          return
        }

        setCall(callRes.data)
        setTurns(turnsRes.data || [])
        setAttentionItems(attentionRes.data || [])
        setAppointment(appointmentRes.data || null)
        setReview(reviewRes.data || null)
        if (reviewRes.data?.note) {
          setNoteInput(reviewRes.data.note)
        }
        setIssueReports(issuesRes.data || [])

        // Collect staff IDs to look up
        const staffIds = new Set()
        if (reviewRes.data?.reviewed_by) {
          staffIds.add(reviewRes.data.reviewed_by)
        }
        for (const issue of issuesRes.data || []) {
          if (issue.reported_by) {
            staffIds.add(issue.reported_by)
          }
        }

        if (staffIds.size > 0) {
          const { data: staffData } = await supabase
            .from('staff_profiles')
            .select('user_id, full_name')
            .in('user_id', Array.from(staffIds))

          if (isMounted && staffData) {
            const map = {}
            for (const s of staffData) {
              map[s.user_id] = s.full_name
            }
            setStaffMap(map)
          }
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load call detail:', err.message || err)
        setError('Unable to load call details. Please try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCallDetails()

    return () => {
      isMounted = false
    }
  }, [callId])

  // Part C: Audit log for view_call (once per page visit)
  useEffect(() => {
    if (!call || !userId || hasAuditedViewRef.current) return
    hasAuditedViewRef.current = true

    // Insert view_call into audit_log; silently ignore any error; NEVER use .select()
    supabase
      .from('audit_log')
      .insert({
        action: 'view_call',
        call_id: Number(call.call_id),
        user_id: userId,
        details: 'Opened call detail and full phone number',
      })
      .then(() => {})
      .catch(() => {})
  }, [call, userId])

  // Part C: Audit log for play_recording (once per page visit)
  const handleAudioPlay = () => {
    if (hasAuditedPlayRef.current || !userId || !callId) return
    hasAuditedPlayRef.current = true

    // Insert play_recording into audit_log; silently ignore any error; NEVER use .select()
    supabase
      .from('audit_log')
      .insert({
        action: 'play_recording',
        call_id: Number(callId),
        user_id: userId,
        details: 'Played recording audio',
      })
      .then(() => {})
      .catch(() => {})
  }

  // Part A: Mark reviewed
  const handleMarkReviewed = async () => {
    if (!userId) return
    setIsSavingReview(true)
    setReviewError(null)

    try {
      const nowIso = new Date().toISOString()
      const { data, error: upsertError } = await supabase
        .from('call_reviews')
        .upsert(
          {
            call_id: Number(callId),
            reviewed_by: userId,
            reviewed_at: nowIso,
            note: review?.note || null,
          },
          { onConflict: 'call_id' }
        )
        .select()

      if (upsertError || !data || data.length === 0) {
        throw upsertError || new Error('Could not save review.')
      }

      const saved = data[0]
      setReview(saved)

      // Ensure staff name is populated in map
      if (!staffMap[userId]) {
        const { data: prof } = await supabase
          .from('staff_profiles')
          .select('user_id, full_name')
          .eq('user_id', userId)
          .maybeSingle()
        if (prof) {
          setStaffMap((prev) => ({ ...prev, [prof.user_id]: prof.full_name }))
        }
      }
    } catch (err) {
      console.error('Failed to mark reviewed:', err.message || err)
      setReviewError('Could not mark as reviewed. Please try again.')
    } finally {
      setIsSavingReview(false)
    }
  }

  // Part A: Add or change note (saving a note also marks the call reviewed)
  const handleSaveNote = async () => {
    if (!userId) return
    setIsSavingReview(true)
    setReviewError(null)

    try {
      const nowIso = new Date().toISOString()
      const trimmedNote = noteInput.trim() || null

      const { data, error: upsertError } = await supabase
        .from('call_reviews')
        .upsert(
          {
            call_id: Number(callId),
            reviewed_by: userId,
            reviewed_at: nowIso,
            note: trimmedNote,
          },
          { onConflict: 'call_id' }
        )
        .select()

      if (upsertError || !data || data.length === 0) {
        throw upsertError || new Error('Could not save note.')
      }

      const saved = data[0]
      setReview(saved)
      setIsEditingNote(false)

      if (!staffMap[userId]) {
        const { data: prof } = await supabase
          .from('staff_profiles')
          .select('user_id, full_name')
          .eq('user_id', userId)
          .maybeSingle()
        if (prof) {
          setStaffMap((prev) => ({ ...prev, [prof.user_id]: prof.full_name }))
        }
      }
    } catch (err) {
      console.error('Failed to save note:', err.message || err)
      setReviewError('Could not save note. Please try again.')
    } finally {
      setIsSavingReview(false)
    }
  }

  // Part A: Report issue
  const handleReportIssue = async (e) => {
    e.preventDefault()
    if (!userId) return
    const reason = issueReason.trim()
    if (!reason) {
      setIssueError('Please enter what went wrong.')
      return
    }

    setIsSubmittingIssue(true)
    setIssueError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('issue_reports')
        .insert({
          call_id: Number(callId),
          reported_by: userId,
          reason,
          status: 'open',
        })
        .select()

      if (insertError || !data || data.length === 0) {
        throw insertError || new Error('Could not report issue.')
      }

      const newIssue = data[0]
      setIssueReports((prev) => [newIssue, ...prev])
      setIssueSuccess(`Issue reported on ${formatIST(newIssue.created_at)}`)
      setIssueReason('')
      setIsReportingOpen(false)

      if (!staffMap[userId]) {
        const { data: prof } = await supabase
          .from('staff_profiles')
          .select('user_id, full_name')
          .eq('user_id', userId)
          .maybeSingle()
        if (prof) {
          setStaffMap((prev) => ({ ...prev, [prof.user_id]: prof.full_name }))
        }
      }
    } catch (err) {
      console.error('Failed to report issue:', err.message || err)
      setIssueError('Could not report issue. Please try again.')
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/calls" className="btn btn-back">
            ← Back
          </Link>
        </header>
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Loading call details...</p>
        </div>
      </div>
    )
  }

  if (error || !call) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/calls" className="btn btn-back">
            ← Back
          </Link>
        </header>
        <div className="card error-card">
          <p className="error-text">{error || 'Call not found.'}</p>
          <Link to="/calls" className="btn btn-primary">
            Return to Call Log
          </Link>
        </div>
      </div>
    )
  }

  const patientNumber = getPatientNumber(call)
  const callerName = call.variables?.full_name
    ? String(call.variables.full_name)
    : 'Unknown caller'
  const outcome = getOutcome(call, appointment, attentionItems)
  const openAttentionItems = attentionItems.filter((item) => item.status === 'open')
  const variables = call.variables || {}
  const reviewerName = review?.reviewed_by ? staffMap[review.reviewed_by] || 'Staff' : null

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/calls" className="btn btn-back">
          ← Back
        </Link>
      </header>

      {/* Top Details Card */}
      <section className="card call-top-card">
        <div className="top-header-row">
          <div>
            <h1 className="detail-caller-name">{callerName}</h1>
            <div className="phone-row">
              {patientNumber !== '-' ? (
                <a
                  href={`tel:${patientNumber}`}
                  className="tel-link"
                  title="Tap to call back"
                >
                  📞 {patientNumber}
                </a>
              ) : (
                <span className="tel-link-disabled">No phone number</span>
              )}
            </div>
          </div>
          <span className={`badge outcome-badge outcome-${outcome.color}`}>
            {outcome.label}
          </span>
        </div>

        <div className="detail-meta-grid">
          <div className="meta-box">
            <span className="meta-label">Date & Time</span>
            <span className="meta-value">{formatIST(call.started_at)}</span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Duration</span>
            <span className="meta-value">{formatDuration(call.duration_seconds)}</span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Language</span>
            <span className="meta-value">
              {formatVariableValue(variables.call_language)}
            </span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Direction</span>
            <span className="meta-value capitalize">
              {call.direction || 'Inbound'}
            </span>
          </div>
        </div>

        {/* Red Needs attention box for open attention items */}
        {openAttentionItems.length > 0 && (
          <div className="attention-alert-box" role="alert">
            <div className="attention-alert-header">
              <span className="attention-alert-title">⚠️ Needs attention</span>
            </div>
            <ul className="attention-item-list">
              {openAttentionItems.map((item, idx) => (
                <li key={idx} className="attention-item-name">
                  {formatAttentionType(item.type)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Part A: Review & Quality Section */}
      <section className="card detail-section-card review-actions-card">
        <h2 className="section-title">Review & Quality</h2>

        {reviewError && (
          <div className="alert alert-error" role="alert">
            {reviewError}
          </div>
        )}

        {/* Review Status Display */}
        {review ? (
          <div className="reviewed-status-box">
            <div className="reviewed-banner">
              <span className="reviewed-icon">✓</span>
              <span>
                Reviewed by <strong>{reviewerName}</strong> on{' '}
                <strong>{formatIST(review.reviewed_at)}</strong>
              </span>
            </div>

            {review.note && !isEditingNote && (
              <div className="saved-note-container">
                <span className="saved-note-label">Review note:</span>
                <p className="saved-note-text">{review.note}</p>
              </div>
            )}

            {!isEditingNote && (
              <div className="review-btn-row">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingNote(true)
                    setNoteInput(review.note || '')
                  }}
                  className="btn btn-secondary btn-edit-note"
                >
                  {review.note ? 'Change note' : 'Add note'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="not-reviewed-box">
            <p className="not-reviewed-text">This call has not been reviewed yet.</p>
            {!isEditingNote && (
              <div className="review-btn-row">
                <button
                  type="button"
                  onClick={handleMarkReviewed}
                  disabled={isSavingReview}
                  className="btn btn-primary btn-mark-reviewed"
                >
                  {isSavingReview ? 'Saving...' : 'Mark reviewed'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingNote(true)
                    setNoteInput('')
                  }}
                  disabled={isSavingReview}
                  className="btn btn-secondary btn-add-note"
                >
                  Add note
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline Note Editor */}
        {isEditingNote && (
          <div className="note-editor-box">
            <label htmlFor="review-note-input" className="filter-label">
              Review Note (saving also marks call as reviewed)
            </label>
            <textarea
              id="review-note-input"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Good handling of cancellation request..."
              rows={3}
              className="filter-input review-note-textarea"
              disabled={isSavingReview}
            />
            <div className="note-btn-row">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={isSavingReview}
                className="btn btn-primary btn-save-note"
              >
                {isSavingReview ? 'Saving note...' : 'Save note'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingNote(false)
                  setNoteInput(review?.note || '')
                }}
                disabled={isSavingReview}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Issue Reporting Divider */}
        <hr className="section-divider" />

        <div className="issue-reporting-section">
          <div className="issue-section-top">
            <h3 className="sub-section-title">Report Issue</h3>
            {!isReportingOpen && (
              <button
                type="button"
                onClick={() => {
                  setIsReportingOpen(true)
                  setIssueError(null)
                  setIssueSuccess(null)
                }}
                className="btn btn-secondary btn-report-issue"
              >
                ⚠️ Report issue
              </button>
            )}
          </div>

          {issueSuccess && (
            <div className="alert alert-success" role="status">
              ✓ {issueSuccess}
            </div>
          )}

          {issueError && (
            <div className="alert alert-error" role="alert">
              {issueError}
            </div>
          )}

          {/* Issue Reporting Form */}
          {isReportingOpen && (
            <form onSubmit={handleReportIssue} className="issue-report-form">
              <div className="form-field">
                <label htmlFor="issue-reason" className="filter-label">
                  What went wrong? <span className="required-mark">*</span>
                </label>
                <textarea
                  id="issue-reason"
                  required
                  value={issueReason}
                  onChange={(e) => setIssueReason(e.target.value)}
                  placeholder="Describe the issue with the bot response or appointment..."
                  rows={3}
                  className="filter-input issue-textarea"
                  disabled={isSubmittingIssue}
                />
              </div>

              <div className="issue-btn-row">
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="btn btn-primary btn-submit-issue"
                >
                  {isSubmittingIssue ? 'Submitting...' : 'Submit issue'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportingOpen(false)}
                  disabled={isSubmittingIssue}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Existing Issue Reports */}
          {issueReports.length > 0 && (
            <div className="issue-reports-list">
              <h4 className="issue-list-heading">
                Reported Issues ({issueReports.length})
              </h4>
              <div className="issue-cards-wrapper">
                {issueReports.map((item) => {
                  const reporter = staffMap[item.reported_by] || 'Staff'
                  const isClosed = item.status === 'closed'
                  return (
                    <div key={item.id} className="issue-item-card">
                      <div className="issue-item-top">
                        <span
                          className={`badge ${
                            isClosed ? 'status-badge-green' : 'status-badge-orange'
                          }`}
                        >
                          {item.status || 'open'}
                        </span>
                        <span className="issue-time">
                          {formatIST(item.created_at)}
                        </span>
                      </div>
                      <p className="issue-reason-text">{item.reason}</p>
                      <span className="issue-reporter">
                        Reported by: <strong>{reporter}</strong>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Summary Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Summary</h2>
        <p className="summary-text">
          {call.summary && call.summary.trim() !== ''
            ? call.summary
            : 'No summary available for this call.'}
        </p>
      </section>

      {/* Extracted Details Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Extracted Details</h2>
        <div className="extracted-grid">
          <div className="extracted-row">
            <span className="extracted-label">Name</span>
            <span className="extracted-value">
              {formatVariableValue(variables.full_name)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">New or existing patient</span>
            <span className="extracted-value">
              {formatVariableValue(variables.patient_status)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Reason for visit</span>
            <span className="extracted-value">
              {formatVariableValue(variables.reason_for_visit)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Preferred time</span>
            <span className="extracted-value">
              {formatVariableValue(variables.preferred_date_time)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Appointment action</span>
            <span className="extracted-value">
              {formatVariableValue(variables.appointment_action)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Confirmed slot</span>
            <span className="extracted-value">
              {formatVariableValue(variables.confirmed_slot)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Language</span>
            <span className="extracted-value">
              {formatVariableValue(variables.call_language)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Emergency</span>
            <span className="extracted-value">
              {formatVariableValue(variables.emergency_flag)}
            </span>
          </div>

          {appointment && (
            <div className="extracted-row appointment-extracted-row">
              <span className="extracted-label">Appointment</span>
              <span className="extracted-value appointment-highlight">
                Booked for {formatIST(appointment.slot_start)} ({appointment.status})
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Recording Card (triggers play_recording audit on play) */}
      <section className="card detail-section-card">
        <h2 className="section-title">Recording</h2>
        {call.recording_url ? (
          <div className="audio-player-wrapper">
            <audio
              controls
              preload="none"
              src={call.recording_url}
              onPlay={handleAudioPlay}
              className="audio-player"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <p className="no-recording-text">No recording</p>
        )}
      </section>

      {/* Transcript Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Transcript</h2>
        {turns.length === 0 ? (
          <p className="empty-transcript-text">No transcript turns available.</p>
        ) : (
          <div className="transcript-list">
            {turns.map((turn, index) => {
              const timeString = formatISTTime(turn.turn_time)
              return (
                <div key={turn.sequence || index} className="turn-pair">
                  {turn.user_query && (
                    <div className="chat-bubble-container caller-side">
                      <div className="chat-bubble caller-bubble">
                        <span className="bubble-sender">Caller</span>
                        <p className="bubble-text">{turn.user_query}</p>
                        {timeString && (
                          <span className="bubble-timestamp">{timeString}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {turn.bot_response && (
                    <div className="chat-bubble-container bot-side">
                      <div className="chat-bubble bot-bubble">
                        <span className="bubble-sender">Receptionist (AI)</span>
                        <p className="bubble-text">{turn.bot_response}</p>
                        {timeString && (
                          <span className="bubble-timestamp">{timeString}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
