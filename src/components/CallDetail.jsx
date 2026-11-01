import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getPatientNumber,
  getOutcome,
} from '../lib/helpers'
import CallHeader from './CallHeader'
import SummaryCard from './SummaryCard'
import ExtractedDetails from './ExtractedDetails'
import ReviewPanel from './ReviewPanel'
import RecordingCard from './RecordingCard'
import TranscriptBubbles from './TranscriptBubbles'
import Toast from './Toast'

export default function CallDetail({ currentUserId }) {
  const { callId } = useParams()
  const navigate = useNavigate()
  const [resolvedUserId, setResolvedUserId] = useState(null)
  const userId = currentUserId || resolvedUserId
  const [userRole, setUserRole] = useState('staff')

  // Data states
  const [call, setCall] = useState(null)
  const [turns, setTurns] = useState([])
  const [attentionItems, setAttentionItems] = useState([])
  const [appointment, setAppointment] = useState(null)
  const [review, setReview] = useState(null)
  const [issueReports, setIssueReports] = useState([])
  const [staffMap, setStaffMap] = useState({})

  // Page status
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Notification feedback
  const [toast, setToast] = useState({ message: '', type: 'success' })

  // Audit log refs (once per visit, strictly guard against StrictMode)
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

  // Resolve user role
  useEffect(() => {
    if (!userId) return
    let isMounted = true

    supabase
      .from('staff_profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted && data?.role) {
          setUserRole(data.role.toLowerCase())
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [userId])

  // Load call details
  useEffect(() => {
    let isMounted = true

    async function loadCallDetails() {
      if (!callId) return
      setLoading(true)
      setError(null)

      try {
        // Query calls, turns, attention_items, linked appointment, call_reviews, and issue_reports
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
            .select('id, slot_start, status, patient_name')
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

        if (!callRes.data) {
          setError('not_found')
          return
        }

        setCall(callRes.data)
        setTurns(turnsRes.data || [])
        setAttentionItems(attentionRes.data || [])
        setAppointment(appointmentRes?.data || null)
        setReview(reviewRes?.data || null)
        setIssueReports(issuesRes?.data || [])

        // Collect staff IDs to resolve staff names
        const staffIds = new Set()
        if (reviewRes?.data?.reviewed_by) {
          staffIds.add(reviewRes.data.reviewed_by)
        }
        for (const item of issuesRes?.data || []) {
          if (item.reported_by) {
            staffIds.add(item.reported_by)
          }
        }

        if (staffIds.size > 0) {
          const { data: staffData } = await supabase
            .from('staff_profiles')
            .select('user_id, full_name')
            .in('user_id', Array.from(staffIds))

          if (isMounted && staffData) {
            const map = {}
            for (const sp of staffData) {
              map[sp.user_id] = sp.full_name
            }
            setStaffMap(map)
          }
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load call details:', err.message || err)
        setError('connection_error')
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
  }, [callId, reloadKey])

  // Single view_call audit_log write on visit (NEVER use .select())
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

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  const handleNotify = (message, type = 'success') => {
    setToast({ message, type })
  }

  // 1. Loading Skeleton shaped like the page
  if (loading) {
    return (
      <div className="page-container call-detail-page-screen">
        <div className="skeleton-back-button pulse-skeleton" />
        <div className="card skeleton-hero-card pulse-skeleton" />
        <div className="card skeleton-summary-card pulse-skeleton" />
        <div className="skeleton-two-col-layout">
          <div className="card skeleton-left-card pulse-skeleton" />
          <div className="skeleton-right-stack">
            <div className="card skeleton-right-card pulse-skeleton" />
            <div className="card skeleton-right-card-small pulse-skeleton" />
          </div>
        </div>
        <div className="card skeleton-transcript-card pulse-skeleton" />
      </div>
    )
  }

  // 2. Not-found state
  if (error === 'not_found' || (!call && !error)) {
    return (
      <div className="page-container call-detail-page-screen">
        <div className="call-top-back-row">
          <button
            type="button"
            onClick={() => navigate('/calls')}
            className="btn btn-secondary btn-call-back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back</span>
          </button>
        </div>

        <div className="card empty-card call-not-found-card" role="status">
          <div className="empty-icon-wrap">
            <AlertCircle size={38} className="empty-icon-accent" aria-hidden="true" />
          </div>
          <h2 className="empty-title">Call Not Found</h2>
          <p className="empty-subtitle">
            This call could not be found. It may have been removed or the link is incorrect.
          </p>
          <button
            type="button"
            onClick={() => navigate('/calls')}
            className="btn btn-primary mt-16"
          >
            Return to Call Log
          </button>
        </div>
      </div>
    )
  }

  // 3. Friendly Error State with Try Again
  if (error) {
    return (
      <div className="page-container call-detail-page-screen">
        <div className="call-top-back-row">
          <button
            type="button"
            onClick={() => navigate('/calls')}
            className="btn btn-secondary btn-call-back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back</span>
          </button>
        </div>

        <div className="card error-card" role="alert">
          <AlertCircle size={36} className="error-icon" aria-hidden="true" />
          <h2 className="error-title">Unable to Load Call Details</h2>
          <p className="error-text">
            Something went wrong while loading this call. Please check your network connection and try again.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="btn btn-primary"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      </div>
    )
  }

  const patientNumber = getPatientNumber(call)
  const callerName = call.variables?.full_name
    ? String(call.variables.full_name)
    : 'Unknown caller'
  const outcome = getOutcome(call, appointment, attentionItems)
  const isReviewed = Boolean(review)

  return (
    <div className="page-container call-detail-page-screen">
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ message: '', type: 'success' })}
      />

      {/* 1. Top Back Button & Header Hero Card */}
      <CallHeader
        call={call}
        patientNumber={patientNumber}
        callerName={callerName}
        outcome={outcome}
        isReviewed={isReviewed}
      />

      {/* 
        Body Sections Container:
        Desktop: Summary -> Two Columns (60% Left, 40% Right) -> Transcript
        Mobile (< 1024px): Single column in exact order:
          1. Summary
          2. Review & Quality
          3. Extracted Details
          4. Recording
          5. Transcript
      */}
      <div className="call-detail-layout-container">
        {/* Item 1: Summary Card */}
        <div className="call-detail-item-summary">
          <SummaryCard summary={call.summary} />
        </div>

        {/* Two-Column Area Wrapper */}
        <div className="call-detail-two-col-wrapper">
          {/* Item 3 (on mobile): Extracted Details (LEFT on desktop) */}
          <div className="call-detail-item-extracted">
            <ExtractedDetails
              variables={call.variables || {}}
              appointment={appointment}
            />
          </div>

          {/* Right Column Stack on Desktop */}
          <div className="call-detail-right-stack-wrapper">
            {/* Item 2 (on mobile): Review & Quality (RIGHT (a) on desktop) */}
            <div className="call-detail-item-review">
              <ReviewPanel
                callId={call.call_id}
                userId={userId}
                userRole={userRole}
                review={review}
                setReview={setReview}
                staffMap={staffMap}
                setStaffMap={setStaffMap}
                issueReports={issueReports}
                setIssueReports={setIssueReports}
                onNotify={handleNotify}
              />
            </div>

            {/* Item 4 (on mobile): Recording Card (RIGHT (b) on desktop) */}
            <div className="call-detail-item-recording">
              <RecordingCard
                recordingUrl={call.recording_url}
                callId={call.call_id}
                userId={userId}
              />
            </div>
          </div>
        </div>

        {/* Item 5: Full-Width Transcript Card */}
        <div className="call-detail-item-transcript">
          <TranscriptBubbles turns={turns} />
        </div>
      </div>
    </div>
  )
}
