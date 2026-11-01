import { useState } from 'react'
import {
  ShieldCheck,
  Check,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Send,
  Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatIST } from '../lib/helpers'

export default function ReviewPanel({
  callId,
  userId,
  userRole = 'staff',
  review = null,
  setReview,
  staffMap = {},
  setStaffMap,
  issueReports = [],
  setIssueReports,
  onNotify,
}) {
  // Review actions state
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [reviewError, setReviewError] = useState(null)

  // Note editor state
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(review?.note || '')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteError, setNoteError] = useState(null)

  // Issue reporting state
  const [isReportingIssue, setIsReportingIssue] = useState(false)
  const [issueReason, setIssueReason] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)
  const [issueError, setIssueError] = useState(null)
  const [closingIssueId, setClosingIssueId] = useState(null)

  const isReviewed = Boolean(review)
  const reviewerName = review?.reviewed_by ? staffMap[review.reviewed_by] || 'Staff' : null

  // Ensure staff name is populated in map
  const ensureStaffInMap = async (targetUserId) => {
    if (!targetUserId || staffMap[targetUserId]) return
    try {
      const { data } = await supabase
        .from('staff_profiles')
        .select('user_id, full_name')
        .eq('user_id', targetUserId)
        .maybeSingle()
      if (data) {
        setStaffMap((prev) => ({ ...prev, [data.user_id]: data.full_name }))
      }
    } catch {
      // Ignore
    }
  }

  // 1. Mark Reviewed
  const handleMarkReviewed = async () => {
    if (!userId || isReviewed || isSavingReview) return
    setIsSavingReview(true)
    setReviewError(null)

    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
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

      if (error || !data || data.length === 0) {
        throw error || new Error('Could not mark as reviewed.')
      }

      const saved = data[0]
      setReview(saved)
      await ensureStaffInMap(userId)
      onNotify?.('Call marked as reviewed', 'success')
    } catch (err) {
      console.error('Failed to mark reviewed:', err.message || err)
      setReviewError('Unable to mark call as reviewed. Please try again.')
    } finally {
      setIsSavingReview(false)
    }
  }

  // 2. Save Note (also updates call review)
  const handleSaveNote = async () => {
    if (!userId || isSavingNote) return
    setIsSavingNote(true)
    setNoteError(null)

    try {
      const nowIso = new Date().toISOString()
      const trimmedNote = noteText.trim() || null

      const { data, error } = await supabase
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

      if (error || !data || data.length === 0) {
        throw error || new Error('Could not save note.')
      }

      const saved = data[0]
      setReview(saved)
      setIsEditingNote(false)
      await ensureStaffInMap(userId)
      onNotify?.('Note saved', 'success')
    } catch (err) {
      console.error('Failed to save note:', err.message || err)
      setNoteError('Unable to save note. Please try again.')
    } finally {
      setIsSavingNote(false)
    }
  }

  // 3. Submit Issue Report
  const handleSubmitIssue = async (e) => {
    e.preventDefault()
    if (!userId || isSubmittingIssue) return

    const trimmed = issueReason.trim()
    if (!trimmed) {
      setIssueError('Please enter what went wrong.')
      return
    }

    setIsSubmittingIssue(true)
    setIssueError(null)

    try {
      const { data, error } = await supabase
        .from('issue_reports')
        .insert({
          call_id: Number(callId),
          reported_by: userId,
          reason: trimmed,
          status: 'open',
        })
        .select()

      if (error || !data || data.length === 0) {
        throw error || new Error('Could not report issue.')
      }

      const newIssue = data[0]
      setIssueReports((prev) => [newIssue, ...prev])
      setIssueReason('')
      setIsReportingIssue(false)
      await ensureStaffInMap(userId)
      onNotify?.('Issue reported', 'success')
    } catch (err) {
      console.error('Failed to report issue:', err.message || err)
      setIssueError('Could not report issue. Please try again.')
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  // 4. Admin-only: Close Issue
  const handleCloseIssue = async (issueId) => {
    if (userRole !== 'admin' || closingIssueId) return
    setClosingIssueId(issueId)

    try {
      const { error } = await supabase
        .from('issue_reports')
        .update({ status: 'closed' })
        .eq('id', issueId)

      if (error) throw error

      setIssueReports((prev) =>
        prev.map((item) =>
          item.id === issueId ? { ...item, status: 'closed' } : item
        )
      )
      onNotify?.('Issue marked as closed', 'success')
    } catch (err) {
      console.error('Failed to close issue:', err.message || err)
    } finally {
      setClosingIssueId(null)
    }
  }

  return (
    <section className="card call-section-card review-panel-card" aria-label="Review and quality">
      {/* Header */}
      <div className="card-section-header">
        <div className="section-icon-tile" aria-hidden="true">
          <ShieldCheck size={18} />
        </div>
        <h2 className="section-card-title">Review & Quality</h2>
      </div>

      {/* Review Status Line */}
      <div className="review-status-indicator-row">
        <span
          className={`review-status-dot ${isReviewed ? 'dot-reviewed' : 'dot-unreviewed'}`}
          aria-hidden="true"
        />
        <div className="review-status-text-wrap">
          {isReviewed ? (
            <span className="review-status-label-reviewed">
              Reviewed{reviewerName ? ` by ${reviewerName}` : ''}{' '}
              {review?.reviewed_at ? `on ${formatIST(review.reviewed_at)}` : ''}
            </span>
          ) : (
            <span className="review-status-label-unreviewed">
              This call has not been reviewed yet.
            </span>
          )}
        </div>
      </div>

      {/* Error alert for review action */}
      {reviewError && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          {reviewError}
        </div>
      )}

      {/* Mark Reviewed Button / Reviewed State */}
      <div className="review-action-buttons-row">
        {isReviewed ? (
          <button
            type="button"
            disabled
            className="btn btn-reviewed-state"
            aria-disabled="true"
          >
            <Check size={16} aria-hidden="true" />
            <span>Reviewed</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMarkReviewed}
            disabled={isSavingReview}
            className="btn btn-primary btn-mark-reviewed-gradient"
          >
            {isSavingReview ? (
              <Loader2 size={16} className="spinner-inline" aria-hidden="true" />
            ) : (
              <Check size={16} aria-hidden="true" />
            )}
            <span>{isSavingReview ? 'Saving review...' : 'Mark reviewed'}</span>
          </button>
        )}

        {/* Add / Edit Note Trigger Button */}
        {!isEditingNote && (
          <button
            type="button"
            onClick={() => {
              setNoteText(review?.note || '')
              setIsEditingNote(true)
              setNoteError(null)
            }}
            className="btn btn-secondary btn-note-toggle"
          >
            <FileText size={15} aria-hidden="true" />
            <span>{review?.note ? 'Edit note' : 'Add note'}</span>
          </button>
        )}
      </div>

      {/* Existing Note Card (when not currently editing) */}
      {review?.note && !isEditingNote && (
        <div className="existing-note-display-box">
          <div className="note-display-header">
            <span className="note-display-label">Staff note</span>
          </div>
          <p className="note-display-content">{review.note}</p>
        </div>
      )}

      {/* Inline Note Editor Textarea */}
      {isEditingNote && (
        <div className="inline-note-editor-card">
          <label htmlFor="call-staff-note" className="field-label-clean">
            Staff note
          </label>
          {noteError && (
            <div className="alert alert-error mb-8" role="alert" aria-live="polite">
              {noteError}
            </div>
          )}
          <textarea
            id="call-staff-note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add internal notes about this call, caller mood, follow-up..."
            rows={3}
            className="filter-input inline-note-textarea"
            disabled={isSavingNote}
          />
          <div className="note-editor-actions-row">
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isSavingNote}
              className="btn btn-primary btn-save-note-action"
            >
              {isSavingNote ? (
                <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              <span>{isSavingNote ? 'Saving...' : 'Save note'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditingNote(false)
                setNoteText(review?.note || '')
                setNoteError(null)
              }}
              disabled={isSavingNote}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hairline Divider */}
      <hr className="review-section-hairline" />

      {/* Amber Outlined Full-Width Report Issue Button */}
      {!isReportingIssue && (
        <button
          type="button"
          onClick={() => {
            setIsReportingIssue(true)
            setIssueError(null)
          }}
          className="btn btn-amber-outlined-report"
          aria-expanded={isReportingIssue}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Report issue</span>
        </button>
      )}

      {/* Inline Report Issue Form */}
      {isReportingIssue && (
        <form onSubmit={handleSubmitIssue} className="inline-issue-form-card">
          <div className="issue-form-field">
            <label htmlFor="issue-reason-textarea" className="field-label-clean">
              What went wrong? <span className="required-star">*</span>
            </label>
            {issueError && (
              <div className="alert alert-error mb-8" role="alert" aria-live="polite">
                {issueError}
              </div>
            )}
            <textarea
              id="issue-reason-textarea"
              required
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value)}
              placeholder="e.g. Bot gave incorrect dental pricing or failed to capture preferred time..."
              rows={3}
              className="filter-input issue-textarea-clean"
              disabled={isSubmittingIssue}
            />
          </div>

          <div className="issue-form-actions-row">
            <button
              type="submit"
              disabled={isSubmittingIssue || !issueReason.trim()}
              className="btn btn-primary btn-submit-issue-action"
            >
              {isSubmittingIssue ? (
                <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
              ) : (
                <Send size={15} aria-hidden="true" />
              )}
              <span>{isSubmittingIssue ? 'Sending...' : 'Send report'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsReportingIssue(false)
                setIssueReason('')
                setIssueError(null)
              }}
              disabled={isSubmittingIssue}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Existing Reported Issues List */}
      {issueReports.length > 0 && (
        <div className="reported-issues-cards-stack">
          {issueReports.map((item) => {
            const isClosed = item.status === 'closed'
            const reporter = staffMap[item.reported_by] || 'Staff'
            const isClosing = closingIssueId === item.id

            return (
              <div key={item.id} className="issue-mini-card">
                <div className="issue-mini-top-row">
                  <span
                    className={`badge ${
                      isClosed ? 'status-badge-green' : 'status-badge-orange'
                    }`}
                  >
                    {isClosed ? (
                      <CheckCircle2 size={12} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={12} aria-hidden="true" />
                    )}
                    <span>{item.status || 'open'}</span>
                  </span>

                  <span className="issue-timestamp-mono font-mono">
                    {formatIST(item.created_at)}
                  </span>
                </div>

                <p className="issue-mini-reason-text">{item.reason}</p>

                <div className="issue-mini-footer-row">
                  <span className="issue-reporter-text">
                    Reported by: <strong>{reporter}</strong>
                  </span>

                  {/* Admin-only close button */}
                  {userRole === 'admin' && !isClosed && (
                    <button
                      type="button"
                      onClick={() => handleCloseIssue(item.id)}
                      disabled={isClosing}
                      className="btn btn-secondary btn-close-issue-admin"
                      title="Mark this issue as resolved/closed"
                    >
                      {isClosing ? (
                        <Loader2 size={12} className="spinner-inline" aria-hidden="true" />
                      ) : (
                        <Check size={12} aria-hidden="true" />
                      )}
                      <span>Close</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
