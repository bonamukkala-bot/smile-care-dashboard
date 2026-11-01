import { useState } from 'react'
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Flag,
} from 'lucide-react'

export default function CallFilterPanel({
  selectedDate,
  onDateChange,
  selectedOutcome,
  onOutcomeChange,
  outcomeOptions = [],
  selectedLanguage,
  onLanguageChange,
  distinctLanguages = [],
  selectedReviewStatus,
  onReviewStatusChange,
  searchQuery,
  onSearchChange,
  flaggedOnly,
  onFlaggedToggle,
  hasActiveFilters,
  activeFilterCount,
  onClearAllFilters,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  return (
    <section className="card filter-panel-card" aria-label="Call Filters">
      {/* Search Input Row (Always visible on all screen sizes) */}
      <div className="filter-search-row">
        <div className="filter-search-wrapper">
          <Search size={18} className="search-field-icon" aria-hidden="true" />
          <input
            id="call-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by caller name or phone digits..."
            className="filter-input search-input-field"
            aria-label="Search calls by caller name or phone digits"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="btn-clear-search"
              aria-label="Clear search text"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mobile Toggle Button (only shown on screens < 640px) */}
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className={`btn btn-secondary filter-mobile-toggle-btn ${
            mobileExpanded || activeFilterCount > 0 ? 'toggle-active' : ''
          }`}
          aria-expanded={mobileExpanded}
          aria-controls="call-filter-collapsible-controls"
          aria-label="Toggle filter options"
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span
              className="filter-count-badge"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          )}
          {mobileExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Grid of Dropdowns & Controls (Always visible desktop; collapsible on phone) */}
      <div
        id="call-filter-collapsible-controls"
        className={`filter-controls-grid ${
          mobileExpanded ? 'grid-expanded' : 'grid-collapsed'
        }`}
      >
        {/* Date Filter */}
        <div className="filter-control-item">
          <label htmlFor="filter-call-date" className="filter-label-clean">
            Date (IST)
          </label>
          <div className="filter-input-with-clear">
            <input
              id="filter-call-date"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="filter-select-clean date-picker-clean"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => onDateChange('')}
                className="btn-clear-date-input"
                title="Clear date"
                aria-label="Clear date filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Outcome Select */}
        <div className="filter-control-item">
          <label htmlFor="filter-call-outcome" className="filter-label-clean">
            Outcome
          </label>
          <select
            id="filter-call-outcome"
            value={selectedOutcome}
            onChange={(e) => onOutcomeChange(e.target.value)}
            className="filter-select-clean"
          >
            <option value="all">All Outcomes</option>
            {outcomeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Language Select */}
        <div className="filter-control-item">
          <label htmlFor="filter-call-language" className="filter-label-clean">
            Language
          </label>
          <select
            id="filter-call-language"
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="filter-select-clean"
          >
            <option value="all">All Languages</option>
            {distinctLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Review Status Select */}
        <div className="filter-control-item">
          <label htmlFor="filter-call-review" className="filter-label-clean">
            Review Status
          </label>
          <select
            id="filter-call-review"
            value={selectedReviewStatus}
            onChange={(e) => onReviewStatusChange(e.target.value)}
            className="filter-select-clean"
          >
            <option value="all">All Review Status</option>
            <option value="reviewed">Reviewed</option>
            <option value="not_reviewed">Not reviewed</option>
          </select>
        </div>

        {/* Flagged Only Toggle */}
        <div className="filter-control-item filter-control-checkbox">
          <button
            type="button"
            onClick={onFlaggedToggle}
            className={`btn btn-toggle-filter ${
              flaggedOnly ? 'toggle-active' : ''
            }`}
            aria-pressed={flaggedOnly}
          >
            <Flag
              size={16}
              className={flaggedOnly ? 'icon-flag-active' : 'icon-flag-muted'}
              aria-hidden="true"
            />
            <span>Needs attention only</span>
          </button>
        </div>

        {/* Clear All Filters Button */}
        {hasActiveFilters && (
          <div className="filter-control-item filter-control-clear">
            <button
              type="button"
              onClick={onClearAllFilters}
              className="btn btn-secondary btn-clear-filters-full"
              title="Reset all filters"
            >
              <X size={15} aria-hidden="true" />
              <span>Clear filters ({activeFilterCount})</span>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

