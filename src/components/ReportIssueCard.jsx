import { useState } from 'react'
import { AlertTriangle, Send, X, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatIST } from '../lib/helpers'

export default function ReportIssueCard({
  callId,
  userId,
  issueReports = [],
  setIssueReports,
  staffMap = {},
  setStaffMap,
  onNotify,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId) return

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('Please describe what went wrong.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('issue_reports')
        .insert({
          call_id: Number(callId),
          reported_by: userId,
          reason: trimmedReason,
          status: 'open',
        })
        .select()

      if (insertError || !data || data.length === 0) {
        throw insertError || new Error('Could not report issue.')
      }

      const newIssue = data[0]
      setIssueReports((prev) => [newIssue, ...prev])
      setReason('')
      setIsOpen(false)
      onNotify?.('Issue reported successfully', 'success')

      // Ensure staff name is populated in map if missing
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
      setError('Could not report issue. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card detail-section-card issue-section-card">
      <div className="issue-section-header">
        <div className="section-title-wrap">
          <AlertTriangle size={20} className="section-title-icon text-warning" aria-hidden="true" />
          <h2 className="section-title">
            Reported Issues
            {issueReports.length > 0 && (
              <span className="issue-count-pill">{issueReports.length}</span>
            )}
          </h2>
        </div>

        {!isOpen && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true)
              setError(null)
            }}
            className="btn btn-secondary btn-report-toggle"
          >
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Report an issue with this call</span>
          </button>
        )}
      </div>

      {/* Error alert inside form */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Collapsible Report Form */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="report-issue-form">
          <div className="form-field-group">
            <label htmlFor="issue-report-reason" className="field-label-clean">
              What went wrong? <span className="required-star">*</span>
            </label>
            <textarea
              id="issue-report-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bot incorrectly quoted tooth extraction cost or failed to capture preferred time..."
              rows={3}
              className="filter-input issue-textarea-clean"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-actions-row">
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="btn btn-primary btn-submit-issue-clean"
            >
              <Send size={15} aria-hidden="true" />
              <span>{isSubmitting ? 'Sending report...' : 'Send report'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setError(null)
              }}
              disabled={isSubmitting}
              className="btn btn-secondary"
            >
              <X size={15} aria-hidden="true" />
              <span>Cancel</span>
            </button>
          </div>
        </form>
      )}

      {/* Existing Issue List */}
      {issueReports.length === 0 && !isOpen ? (
        <p className="empty-issues-text">No issues reported for this call.</p>
      ) : (
        <div className="issues-cards-list">
          {issueReports.map((item) => {
            const reporter = staffMap[item.reported_by] || 'Staff'
            const isClosed = item.status === 'closed'
            return (
              <div key={item.id} className="issue-row-card">
                <div className="issue-row-top">
                  <span
                    className={`badge ${
                      isClosed ? 'status-badge-green' : 'status-badge-orange'
                    }`}
                  >
                    {isClosed ? (
                      <CheckCircle2 size={13} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={13} aria-hidden="true" />
                    )}
                    <span>{item.status || 'open'}</span>
                  </span>
                  <span className="issue-date-mono">{formatIST(item.created_at)}</span>
                </div>
                <p className="issue-reason-body">{item.reason}</p>
                <div className="issue-reporter-footer">
                  <span>Reported by:</span>
                  <strong>{reporter}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

