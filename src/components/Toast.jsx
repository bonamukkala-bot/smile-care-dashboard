import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export default function Toast({ message, type = 'success', onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => {
      onDismiss?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!message) return null

  const IconComponent =
    type === 'error' ? AlertCircle : type === 'info' ? Info : CheckCircle2

  return (
    <div
      className={`toast-container toast-${type}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="toast-content">
        <IconComponent size={20} className="toast-icon" aria-hidden="true" />
        <span className="toast-message">{message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="toast-close-btn"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}

