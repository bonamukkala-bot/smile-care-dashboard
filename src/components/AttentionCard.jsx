import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  PhoneOff,
  CalendarX,
  PhoneMissed,
  Info,
  Clock,
  Phone,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { formatIST, maskPhone } from '../lib/helpers'

// Friendly type metadata
const TYPE_META = {
  emergency: {
    label: 'Emergency',
    icon: AlertTriangle,
    className: 'badge-type-emergency',
  },
  hung_up_midway: {
    label: 'Caller hung up',
    icon: PhoneOff,
    className: 'badge-type-hungup',
  },
  booking_unconfirmed: {
    label: 'Booking not confirmed',
    icon: CalendarX,
    className: 'badge-type-unconfirmed',
  },
  call_failed: {
    label: 'Call failed',
    icon: PhoneMissed,
    className: 'badge-type-failed',
  },
  other: {
    label: 'Other',
    icon: Info,
    className: 'badge-type-other',
  },
}

function getWaitingDetails(createdAt) {
  if (!createdAt) return { text: 'Waiting -', isOver24H: false }
  const time = new Date(createdAt).getTime()
  if (isNaN(time)) return { text: 'Waiting -', isOver24H: false }
  const diff = Math.max(0, Date.now() - time)
  const isOver24H = diff > 24 * 60 * 60 * 1000

  if (isOver24H) {
    return { text: 'Waiting over 24 h', isOver24H: true }
  }

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) {
    return { text: `Waiting ${Math.max(1, minutes)} min`, isOver24H: false }
  }
  return { text: `Waiting ${hours} h`, isOver24H: false }
}

function getPatientInitials(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return null
  const trimmed = name.trim()
  const chars = Array.from(trimmed)
  // Non-Latin (Telugu, etc.)
  if (chars[0].codePointAt(0) > 127) {
    return chars[0]
  }
  // Latin names
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function AttentionCard({
  item,
  isFirstCard = false,
  isResolving = false,
  resolveNote = '',
  onNoteChange,
  onStartResolve,
  onCancelResolve,
  onConfirmResolve,
  isSaving = false,
  saveError = null,
  textareaRef,
  isFadingOut = false,
}) {
  const [copied, setCopied] = useState(false)
  const [showFullSummary, setShowFullSummary] = useState(false)
  const copyTimerRef = useRef(null)

  const isEmergency = item.type === 'emergency'
  const typeMeta = TYPE_META[item.type] || TYPE_META.other
  const TypeIcon = typeMeta.icon

  const call = item.call
  const callerName = call?.variables?.full_name
    ? String(call.variables.full_name).trim()
    : 'Unknown caller'
  const initials = getPatientInitials(callerName)

  // Full patient phone for call/copy
  const fullPhone = call?.patient_number || call?.from_number || ''
  const maskedPhone = fullPhone ? maskPhone(fullPhone) : 'No phone number'

  const callTimeIST = formatIST(call?.started_at)
  const summaryText = (call?.summary || '').trim()
  const isSummaryLong = summaryText.length > 160

  const { text: waitText, isOver24H } = getWaitingDetails(item.created_at)

  const handleCopyPhone = async () => {
    if (!fullPhone) return
    try {
      await navigator.clipboard.writeText(fullPhone)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      // Clipboard fallback
    }
  }

  return (
    <article
      className={`card attention-triage-card ${
        isEmergency ? 'card-emergency' : 'card-standard'
      } ${isFadingOut ? 'card-fade-out' : ''}`}
      id={`attention-item-${item.id}`}
    >
      {/* 1. Top Header Row: Type Badge + Waiting Pill */}
      <div className="triage-card-header">
        <div className="triage-type-wrapper">
          <span className={`badge triage-type-badge ${typeMeta.className}`}>
            <TypeIcon size={15} className="triage-badge-icon" aria-hidden="true" />
            <span>{typeMeta.label}</span>
          </span>
        </div>

        <div
          className={`waiting-pill ${isOver24H ? 'waiting-pill-danger' : ''}`}
          title={`Created at ${formatIST(item.created_at)}`}
        >
          <Clock size={14} className="waiting-pill-icon" aria-hidden="true" />
          <span>{waitText}</span>
        </div>
      </div>

      {/* 2. Body: Two columns on desktop, stacked on mobile */}
      <div className="triage-card-body">
        {/* Left Column: Avatar + Name + Masked Phone with Copy + Summary */}
        <div className="triage-left-col">
          <div className="triage-patient-row">
            <div
              className={`patient-avatar ${
                isEmergency ? 'avatar-emergency' : 'avatar-standard'
              }`}
              aria-hidden="true"
            >
              {initials ? initials : <Phone size={18} />}
            </div>

            <div className="patient-meta-text">
              <h3 className="patient-display-name">{callerName}</h3>
              <div className="phone-copy-row">
                <span className="patient-masked-phone">{maskedPhone}</span>
                {fullPhone && (
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="btn-copy-phone"
                    aria-label="Copy phone number"
                    title={copied ? 'Copied!' : 'Copy full phone number'}
                  >
                    {copied ? (
                      <span className="copied-text-indicator">
                        <Check size={14} /> Copied
                      </span>
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="triage-summary-block">
            <span className="triage-summary-label">SUMMARY</span>
            <p
              className={`triage-summary-content ${
                !showFullSummary && isSummaryLong ? 'summary-clamped' : ''
              }`}
            >
              {summaryText || 'No summary available'}
            </p>
            {isSummaryLong && (
              <button
                type="button"
                onClick={() => setShowFullSummary((prev) => !prev)}
                className="btn-toggle-summary"
              >
                {showFullSummary ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Bordered Call Info Panel */}
        <div className="triage-right-col">
          <div className="call-info-panel">
            <div className="info-panel-row">
              <span className="panel-row-label">CALL TIME</span>
              <span className="panel-row-value">{callTimeIST}</span>
            </div>

            <div className="info-panel-row">
              <span className="panel-row-label">SOURCE</span>
              <span className="panel-row-value">Voice agent</span>
            </div>

            {item.note && (
              <div className="info-panel-row">
                <span className="panel-row-label">NOTE</span>
                <span className="panel-row-value">{item.note}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Footer Row: Shortcut hint on left, Action buttons on right */}
      <div className="triage-card-footer">
        <div className="footer-left-hint">
          {isFirstCard && (
            <span className="keyboard-shortcut-hint">
              Press <kbd className="key-cap">R</kbd> to resolve
            </span>
          )}
        </div>

        <div className="footer-actions-group">
          {/* Open call link */}
          <Link
            to={`/calls/${item.call_id}`}
            className="btn btn-secondary btn-triage-action"
            title="Open full call detail"
          >
            <span>Open call</span>
            <ExternalLink size={16} />
          </Link>

          {/* Call back button */}
          {fullPhone && (
            <a
              href={`tel:${fullPhone}`}
              className={`btn btn-triage-action ${
                isEmergency ? 'btn-danger-action' : 'btn-secondary'
              }`}
              title="Call patient now"
            >
              <Phone size={16} />
              <span>{isEmergency ? 'Call back now' : 'Call back'}</span>
            </a>
          )}

          {/* Mark resolved button */}
          {!isResolving && (
            <button
              type="button"
              onClick={onStartResolve}
              className="btn btn-primary btn-triage-action"
            >
              <Check size={16} />
              <span>Mark resolved</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Inline Resolve Panel */}
      {isResolving && (
        <div className="inline-resolve-panel" role="region" aria-label="Resolve attention item">
          <label htmlFor={`resolve-note-${item.id}`} className="resolve-panel-label">
            Resolution note <span className="required-star">*</span>
          </label>
          <textarea
            ref={textareaRef}
            id={`resolve-note-${item.id}`}
            value={resolveNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g. Called back and rescheduled for Tuesday morning"
            className="resolve-panel-textarea"
            disabled={isSaving}
            rows={3}
            required
          />
          <p className="resolve-helper-text">
            Enter details about how this issue was resolved (required).
          </p>

          {saveError && (
            <div className="alert alert-error resolve-error-box" role="alert">
              {saveError}
            </div>
          )}

          <div className="resolve-panel-btn-row">
            <button
              type="button"
              onClick={onConfirmResolve}
              disabled={isSaving || !resolveNote.trim()}
              className="btn btn-primary btn-confirm-resolve"
            >
              {isSaving ? 'Resolving...' : 'Confirm resolved'}
            </button>
            <button
              type="button"
              onClick={onCancelResolve}
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
