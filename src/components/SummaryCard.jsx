import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

export default function SummaryCard({ summary }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const summaryText = summary && typeof summary === 'string' && summary.trim() ? summary.trim() : null
  const isLong = summaryText && summaryText.length > 280

  return (
    <section className="card call-section-card summary-card-container" aria-label="Call summary">
      <div className="card-section-header">
        <div className="section-icon-tile" aria-hidden="true">
          <Sparkles size={18} />
        </div>
        <h2 className="section-card-title">Summary</h2>
      </div>

      {summaryText ? (
        <div className="summary-body-wrapper">
          <p
            className={`summary-readable-text ${
              !isExpanded && isLong ? 'summary-clamped-5' : ''
            }`}
          >
            {summaryText}
          </p>

          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="btn-toggle-summary-inline"
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? 'Show less' : 'Show more'}</span>
              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      ) : (
        <p className="empty-summary-message">No summary available</p>
      )}
    </section>
  )
}

