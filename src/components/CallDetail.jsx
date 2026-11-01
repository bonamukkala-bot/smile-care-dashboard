import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Copy,
  Check,
  CheckCircle2,
  Flag,
  Calendar,
  Clock,
  Globe,
  Activity,
  FileText,
  CalendarCheck,
  ExternalLink,
  Save,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  formatDuration,
  getPatientNumber,
  maskPhone,
  getOutcome,
  formatVariableValue,
  formatAttentionType,
  formatSlotRange,
} from '../lib/helpers'
import TranscriptBubbles from './TranscriptBubbles'
import RecordingPlayer from './RecordingPlayer'
import ReportIssueCard from './ReportIssueCard'
import Toast from './Toast'

function getAvatarInitials(name) {
  if (!name || typeof name !== 'string') return '?'
  const trimmed = name.trim()
  if (!trimmed || trimmed.toLowerCase() === 'unknown caller') return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    const chars = Array.from(parts[0])
    return (chars[0] || '?').toUpperCase()
  }
  const first = Array.from(parts[0])[0] || ''
  const last = Array.from(parts[parts.length - 1])[0] || ''
  return (first + last).toUpperCase()
}

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

  // Review & staff state
  const [review, setReview] = useState(null)
  const [staffMap, setStaffMap] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [reviewError, setReviewError] = useState(null)

  // Summary clamp state
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  // Copy phone feedback
  const [copiedPhone, setCopiedPhone] = useState(false)

  // Issues state
  const [issueReports, setIssueReports] = useState([])

  // Toast state
  const [toast, setToast] = useState({ message: '', type: 'success' })

  // Audit log refs (guard against double execution in React StrictMode)
  const hasAuditedViewRef = useRef(false)

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
        // Fetch call (WITHOUT raw_payload or full_conversation), turns, attention items, appointment, reviews, and issues
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
            .select('id, call_id, patient_name, slot_start, status')
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

        // Collect staff IDs to lookup names
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

  // Audit log for view_call (once per page visit; NEVER use .select())
  useEffect(() => {
    if (!call || !userId || hasAuditedViewRef.current) return
    hasAuditedViewRef.current = true

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

  // Copy full phone number
  const handleCopyPhone = async (phone) => {
    if (!phone || phone === '-') return
    try {
      await navigator.clipboard.writeText(phone)
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Mark reviewed
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
        throw upsertError || new Error('Could not mark as reviewed.')
      }

      const saved = data[0]
      setReview(saved)
      setToast({ message: 'Call marked as reviewed', type: 'success' })

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

  // Save note (saving a note also marks the call as reviewed)
  const handleSaveNote = async () => {
    if (!userId) return
    setIsSavingNote(true)
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
      setToast({ message: 'Staff note saved', type: 'success' })

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
      setIsSavingNote(false)
    }
  }

  // Toast dismiss helper
  const handleDismissToast = () => {
    setToast({ message: '', type: 'success' })
  }

  // Loading skeleton state
  if (loading) {
    return (
      <div className="page-container call-detail-screen">
        <header className="call-detail-top-nav">
          <Link to="/calls" className="btn btn-secondary btn-header-back">
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Back to Call Log</span>
          </Link>
        </header>
        <div className="call-detail-skeletons" aria-label="Loading call details">
          <div className="card skeleton-detail-hero pulse-skeleton" />
          <div className="card skeleton-detail-body pulse-skeleton" />
          <div className="card skeleton-detail-body pulse-skeleton" />
        </div>
      </div>
    )
  }

  // Error / Not found state
  if (error || !call) {
    return (
      <div className="page-container call-detail-screen">
        <header className="call-detail-top-nav">
          <Link to="/calls" className="btn btn-secondary btn-header-back">
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Back to Call Log</span>
          </Link>
        </header>
        <div className="card error-card" role="alert">
          <AlertCircle size={32} className="error-icon" aria-hidden="true" />
          <p className="error-text">{error || 'Call not found.'}</p>
          <Link to="/calls" className="btn btn-primary">
            Return to Call Log
          </Link>
        </div>
      </div>
    )
  }

  const patientNumber = getPatientNumber(call)
  const maskedNumber = maskPhone(patientNumber)
  const callerName = call.variables?.full_name
    ? String(call.variables.full_name)
    : 'Unknown caller'
  const avatarInitials = getAvatarInitials(callerName)
  const outcome = getOutcome(call, appointment, attentionItems)
  const openAttentionItems = attentionItems.filter((item) => item.status === 'open')
  const variables = call.variables || {}
  const reviewerName = review?.reviewed_by ? staffMap[review.reviewed_by] || 'Staff' : null
  const summaryText = call.summary && call.summary.trim() ? call.summary.trim() : null
  const isSummaryLong = summaryText && summaryText.length > 240

  return (
    <div className="page-container call-detail-screen">
      {/* Toast notification banner */}
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={handleDismissToast}
      />

      {/* Top Navigation Row: Back button */}
      <header className="call-detail-top-nav">
        <Link to="/calls" className="btn btn-secondary btn-header-back" title="Back to Call Log">
          <ArrowLeft size={17} aria-hidden="true" />
          <span>Back to Call Log</span>
        </Link>
      </header>

      {/* Hero Header Card */}
      <section className={`card call-hero-card outcome-stripe-${outcome.color}`}>
        <div className="call-hero-main-row">
          {/* Avatar with Telugu-safe initials */}
          <div className="caller-avatar-circle" aria-hidden="true">
            {avatarInitials}
          </div>

          {/* Caller information */}
          <div className="caller-hero-info">
            <h1 className="caller-hero-name">{callerName}</h1>

            <div className="caller-contact-meta">
              <span className="caller-phone-mono">{maskedNumber}</span>
              {patientNumber !== '-' && (
                <div className="caller-phone-actions">
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(patientNumber)}
                    className="btn btn-ghost-icon"
                    title={copiedPhone ? 'Copied!' : 'Copy full phone number'}
                    aria-label="Copy full phone number"
                  >
                    {copiedPhone ? (
                      <Check size={15} className="text-success" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <a
                    href={`tel:${patientNumber}`}
                    className="btn btn-ghost-icon"
                    title="Tap to call back"
                    aria-label={`Call back ${patientNumber}`}
                  >
                    <Phone size={15} />
                  </a>
                </div>
              )}
            </div>

            <div className="caller-datetime-row">
              <Calendar size={14} aria-hidden="true" />
              <span className="call-datetime-mono">{formatIST(call.started_at)}</span>
            </div>
          </div>

          {/* Top-right review action on desktop */}
          <div className="caller-hero-action-desktop">
            {review ? (
              <div className="reviewed-badge-pill" role="status">
                <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
                <div className="reviewed-pill-text">
                  <strong>Reviewed</strong>
                  <span>{reviewerName} • {formatIST(review.reviewed_at)}</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleMarkReviewed}
                disabled={isSavingReview}
                className="btn btn-primary btn-mark-reviewed-hero"
              >
                <Check size={18} aria-hidden="true" />
                <span>{isSavingReview ? 'Saving...' : 'Mark reviewed'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Badges Row */}
        <div className="call-hero-badges-row">
          <span className={`badge outcome-badge outcome-${outcome.color}`}>
            {outcome.label}
          </span>
          {review && (
            <span className="badge review-badge-success">
              <Check size={13} aria-hidden="true" />
              <span>Reviewed</span>
            </span>
          )}
          {openAttentionItems.length > 0 && (
            <span className="badge flag-badge-danger">
              <Flag size={13} aria-hidden="true" />
              <span>Needs attention ({openAttentionItems.length})</span>
            </span>
          )}
        </div>

        {/* Mobile Full-width Mark Reviewed Button */}
        <div className="caller-hero-action-mobile">
          {review ? (
            <div className="reviewed-badge-pill mobile-full-pill" role="status">
              <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
              <div className="reviewed-pill-text">
                <strong>Reviewed</strong>
                <span>{reviewerName} • {formatIST(review.reviewed_at)}</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleMarkReviewed}
              disabled={isSavingReview}
              className="btn btn-primary btn-mark-reviewed-mobile"
            >
              <Check size={18} aria-hidden="true" />
              <span>{isSavingReview ? 'Saving...' : 'Mark reviewed'}</span>
            </button>
          )}
        </div>

        {/* Open Attention Items Alert Box */}
        {openAttentionItems.length > 0 && (
          <div className="attention-alert-box" role="alert">
            <div className="attention-alert-header">
              <Flag size={16} className="text-danger" aria-hidden="true" />
              <strong className="attention-alert-title">Needs Attention</strong>
            </div>
            <ul className="attention-alert-items-list">
              {openAttentionItems.map((item, idx) => (
                <li key={idx} className="attention-alert-item-name">
                  {formatAttentionType(item.type)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Summary Card with 4-line clamp and Show More toggle */}
      <section className="card detail-section-card summary-section-card">
        <div className="section-title-wrap">
          <FileText size={20} className="section-title-icon" aria-hidden="true" />
          <h2 className="section-title">Summary</h2>
        </div>

        {summaryText ? (
          <div className="summary-content-wrapper">
            <p
              className={`summary-paragraph ${
                !summaryExpanded && isSummaryLong ? 'summary-clamped' : ''
              }`}
            >
              {summaryText}
            </p>
            {isSummaryLong && (
              <button
                type="button"
                onClick={() => setSummaryExpanded((prev) => !prev)}
                className="btn btn-ghost btn-toggle-summary"
                aria-expanded={summaryExpanded}
              >
                <span>{summaryExpanded ? 'Show less' : 'Show more'}</span>
                {summaryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}
          </div>
        ) : (
          <p className="empty-summary-text">No summary available for this call.</p>
        )}
      </section>

      {/* Audio Recording Card */}
      <RecordingPlayer
        recordingUrl={call.recording_url}
        callId={call.call_id}
        userId={userId}
      />

      {/* Details Grid Card (2 cols desktop, 1 col phone) */}
      <section className="card detail-section-card details-grid-card">
        <div className="section-title-wrap">
          <Activity size={20} className="section-title-icon" aria-hidden="true" />
          <h2 className="section-title">Call & Extracted Details</h2>
        </div>

        <div className="details-two-col-grid">
          {/* Call Time */}
          <div className="detail-stat-box">
            <span className="stat-box-label">
              <Clock size={13} aria-hidden="true" />
              <span>Call Time (IST)</span>
            </span>
            <span className="stat-box-value font-mono">{formatIST(call.started_at)}</span>
          </div>

          {/* Duration */}
          <div className="detail-stat-box">
            <span className="stat-box-label">
              <Clock size={13} aria-hidden="true" />
              <span>Duration</span>
            </span>
            <span className="stat-box-value">{formatDuration(call.duration_seconds)}</span>
          </div>

          {/* Language */}
          <div className="detail-stat-box">
            <span className="stat-box-label">
              <Globe size={13} aria-hidden="true" />
              <span>Language</span>
            </span>
            <span className="stat-box-value">
              {formatVariableValue(variables.call_language)}
            </span>
          </div>

          {/* Direction */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Direction</span>
            <span className="stat-box-value capitalize">{call.direction || 'Inbound'}</span>
          </div>

          {/* Status & Hang-up Reason */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Status & Hang-up Reason</span>
            <span className="stat-box-value">
              {call.status || 'Completed'}
              {call.hangup_reason
                ? ` • ${call.hangup_reason}`
                : call.hangup_source
                ? ` • ${call.hangup_source}`
                : ''}
            </span>
          </div>

          {/* Sentiment */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Sentiment</span>
            <span className="stat-box-value capitalize">{call.sentiment || '-'}</span>
          </div>

          {/* Reason for Visit */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Reason for Visit</span>
            <span className="stat-box-value">
              {formatVariableValue(variables.reason_for_visit)}
            </span>
          </div>

          {/* Preferred Time */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Preferred Time</span>
            <span className="stat-box-value">
              {formatVariableValue(variables.preferred_date_time)}
            </span>
          </div>

          {/* Confirmed Slot */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Confirmed Slot</span>
            <span className="stat-box-value">
              {formatVariableValue(variables.confirmed_slot)}
            </span>
          </div>

          {/* Appointment Action */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Appointment Action</span>
            <span className="stat-box-value">
              {formatVariableValue(variables.appointment_action)}
            </span>
          </div>

          {/* Emergency Flag */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Emergency Flag</span>
            <span
              className={`stat-box-value ${
                variables.emergency_flag === true ||
                String(variables.emergency_flag).toLowerCase() === 'true'
                  ? 'text-danger font-bold'
                  : ''
              }`}
            >
              {formatVariableValue(variables.emergency_flag)}
            </span>
          </div>

          {/* Patient Status (New or Existing) */}
          <div className="detail-stat-box">
            <span className="stat-box-label">Patient Status</span>
            <span className="stat-box-value">
              {formatVariableValue(variables.patient_status)}
            </span>
          </div>
        </div>
      </section>

      {/* Linked Booking Card (if appointment exists) */}
      {appointment && (
        <section className="card detail-section-card linked-booking-section-card">
          <div className="linked-booking-inner">
            <div className="linked-booking-icon-wrap">
              <CalendarCheck size={24} className="text-success" aria-hidden="true" />
            </div>
            <div className="linked-booking-content">
              <div className="linked-booking-header">
                <span className="linked-booking-tag">Booking from this call</span>
                <span className={`badge outcome-badge outcome-green`}>
                  {appointment.status || 'booked'}
                </span>
              </div>
              <h3 className="linked-booking-patient">{appointment.patient_name || callerName}</h3>
              <p className="linked-booking-time font-mono">
                {formatIST(appointment.slot_start)} ({formatSlotRange(appointment.slot_start)})
              </p>
            </div>
            <Link
              to={`/appointments/${appointment.id}`}
              className="btn btn-secondary btn-view-linked-booking"
              title="Open full appointment record"
            >
              <span>View Appointment</span>
              <ExternalLink size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {/* Transcript Card (Chat Bubbles) */}
      <TranscriptBubbles turns={turns} />

      {/* Staff Notes Card */}
      <section className="card detail-section-card staff-notes-card">
        <div className="section-title-wrap">
          <FileText size={20} className="section-title-icon" aria-hidden="true" />
          <h2 className="section-title">Staff Note</h2>
        </div>

        {reviewError && (
          <div className="alert alert-error" role="alert">
            {reviewError}
          </div>
        )}

        <div className="notes-editor-form">
          <label htmlFor="staff-call-note" className="field-label-clean">
            Internal Staff Note
          </label>
          <textarea
            id="staff-call-note"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Add internal notes about this call, customer mood, follow-up instructions..."
            rows={3}
            className="filter-input staff-note-textarea"
            disabled={isSavingNote}
          />
          <div className="note-action-footer">
            <span className="note-helper-text">
              Saving a note automatically updates the review status of this call.
            </span>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isSavingNote}
              className="btn btn-primary btn-save-note-clean"
            >
              <Save size={16} aria-hidden="true" />
              <span>{isSavingNote ? 'Saving note...' : 'Save note'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Report Issue Card */}
      <ReportIssueCard
        callId={call.call_id}
        userId={userId}
        issueReports={issueReports}
        setIssueReports={setIssueReports}
        staffMap={staffMap}
        setStaffMap={setStaffMap}
        onNotify={(msg, type) => setToast({ message: msg, type })}
      />
    </div>
  )
}
