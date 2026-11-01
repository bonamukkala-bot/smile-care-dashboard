import { useState } from 'react'
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Flag,
} from 'lucide-react'
import {
  formatAppointmentStatus,
  formatDoctorName,
} from '../lib/helpers'

export default function FilterPanel({
  variant = 'appointments', // 'appointments' | 'calllog'

  // Common props
  searchQuery = '',
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  hasActiveFilters = false,
  activeFilterCount = 0,
  onClearFilters,

  // Appointments props
  filterStatus = 'all',
  onStatusChange,
  statusOptions = [],
  filterSource = 'all',
  onSourceChange,
  filterDoctor = 'all',
  onDoctorChange,
  doctors = {},
  showCancelled = false,
  onShowCancelledChange,

  // CallLog props
  selectedDate = '',
  onDateChange,
  selectedOutcome = 'all',
  onOutcomeChange,
  outcomeOptions = [],
  selectedLanguage = 'all',
  onLanguageChange,
  distinctLanguages = [],
  selectedReviewStatus = 'all',
  onReviewStatusChange,
  flaggedOnly = false,
  onFlaggedToggle,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const isAppointments = variant === 'appointments'

  const resolvedSearchPlaceholder =
    searchPlaceholder ||
    (isAppointments
      ? 'Search by name or digits...'
      : 'Search by caller name or phone digits...')

  const resolvedSearchLabel =
    searchLabel ||
    (isAppointments ? 'SEARCH PATIENT OR PHONE' : 'SEARCH CALLER OR PHONE')

  return (
    <section
      className={`card filter-panel-card ${
        isAppointments ? 'filter-panel-appointments' : 'filter-panel-calllog'
      }`}
      aria-label={isAppointments ? 'Appointment Filters' : 'Call Filters'}
    >
      {/* 
        Header Area: Clear Filters button on the right end of the panel
        ONLY when any filter is active, with active-filters count badge.
        Do not show an empty header row when nothing is active.
      */}
      {hasActiveFilters && (
        <div className="filter-panel-header">
          <button
            type="button"
            onClick={onClearFilters}
            className="btn-clear-filters-header"
            aria-label={`Clear all filters, ${activeFilterCount} active`}
          >
            <span>Clear filters</span>
            <span className="filter-active-count-badge" aria-hidden="true">
              {activeFilterCount}
            </span>
          </button>
        </div>
      )}

      {/* 
        Phone-only Top Bar (< 640px):
        Search field stays visible above the "Filters" toggle button.
        On tablet & desktop (>= 640px), this phone container is hidden via CSS.
      */}
      <div className="filter-phone-top-bar">
        <div className="filter-search-wrapper">
          <Search size={18} className="filter-search-icon" aria-hidden="true" />
          <input
            id={`phone-search-${variant}`}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={resolvedSearchPlaceholder}
            className="filter-input-control search-input-control"
            aria-label={resolvedSearchLabel}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="btn-clear-search-x"
              aria-label="Clear search query"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className={`btn btn-secondary filter-mobile-toggle-btn ${
            mobileExpanded || activeFilterCount > 0 ? 'toggle-active' : ''
          }`}
          aria-expanded={mobileExpanded}
          aria-controls={`filter-controls-${variant}`}
          aria-label="Toggle filter options"
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span
              className="filter-active-count-badge"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          )}
          {mobileExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* =========================================================================
         APPOINTMENTS VARIANT CONTROLS
         Desktop (>= 1024px): ONE row inside rounded card:
         Status (1fr) | Source (1fr) | Doctor (1.3fr) | Search patient or phone (2fr) | Show cancelled toggle (auto)
         Tablet (640px - 1023px): Two columns (Search on top full-width, Status & Source row 2, Doctor & Toggle row 3)
         Phone (< 640px): Collapsed behind Filters button; when expanded stacks 1 column at 48px height
         ========================================================================= */}
      {isAppointments && (
        <div
          id={`filter-controls-${variant}`}
          className={`filter-grid-appointments ${
            mobileExpanded ? 'phone-drawer-open' : 'phone-drawer-closed'
          }`}
        >
          {/* 1. Status (1fr) */}
          <div className="filter-cell filter-cell-status">
            <label htmlFor="filter-status-select" className="filter-control-label">
              STATUS
            </label>
            <select
              id="filter-status-select"
              value={filterStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="filter-select-control"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {formatAppointmentStatus(st)}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Source (1fr) */}
          <div className="filter-cell filter-cell-source">
            <label htmlFor="filter-source-select" className="filter-control-label">
              SOURCE
            </label>
            <select
              id="filter-source-select"
              value={filterSource}
              onChange={(e) => onSourceChange(e.target.value)}
              className="filter-select-control"
            >
              <option value="all">All Sources</option>
              <option value="ai">AI booked</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          {/* 3. Doctor (1.3fr) */}
          <div className="filter-cell filter-cell-doctor">
            <label htmlFor="filter-doctor-select" className="filter-control-label">
              DOCTOR
            </label>
            <select
              id="filter-doctor-select"
              value={filterDoctor}
              onChange={(e) => onDoctorChange(e.target.value)}
              className="filter-select-control"
            >
              <option value="all">All Doctors</option>
              {Object.entries(doctors).map(([id, name]) => (
                <option key={id} value={id}>
                  {formatDoctorName(name)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Search patient or phone (2fr on desktop; full-width on tablet) */}
          <div className="filter-cell filter-cell-search desktop-tablet-search-cell">
            <label htmlFor="appointment-search-input" className="filter-control-label">
              SEARCH PATIENT OR PHONE
            </label>
            <div className="filter-search-wrapper">
              <Search size={18} className="filter-search-icon" aria-hidden="true" />
              <input
                id="appointment-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={resolvedSearchPlaceholder}
                className="filter-input-control search-input-control"
                aria-label="Search patient or phone by name or digits"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="btn-clear-search-x"
                  aria-label="Clear search text"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* 5. Show Cancelled Toggle (auto on desktop, real checkbox, no label above) */}
          <div className="filter-cell filter-cell-toggle">
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => onShowCancelledChange(e.target.checked)}
                className="filter-real-checkbox"
                aria-label="Show cancelled bookings"
              />
              <span className="filter-checkbox-text">Show cancelled</span>
            </label>
          </div>
        </div>
      )}

      {/* =========================================================================
         CALL LOG VARIANT CONTROLS
         Desktop (>= 1024px): 3-column grid with 2 rows:
         Row 1: Filter by date | Outcome | Language
         Row 2: Review status | Search caller or phone | Flagged only toggle button
         Tablet (640px - 1023px): 2 columns
         Phone (< 640px): Collapsed behind Filters button; when expanded stacks 1 column
         ========================================================================= */}
      {!isAppointments && (
        <div
          id={`filter-controls-${variant}`}
          className={`filter-grid-calllog ${
            mobileExpanded ? 'phone-drawer-open' : 'phone-drawer-closed'
          }`}
        >
          {/* Row 1, Col 1: Date */}
          <div className="filter-cell calllog-cell-date">
            <label htmlFor="filter-call-date" className="filter-control-label">
              FILTER BY DATE
            </label>
            <div className="filter-date-wrapper">
              <input
                id="filter-call-date"
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="filter-input-control date-picker-control"
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

          {/* Row 1, Col 2: Outcome */}
          <div className="filter-cell calllog-cell-outcome">
            <label htmlFor="filter-call-outcome" className="filter-control-label">
              OUTCOME
            </label>
            <select
              id="filter-call-outcome"
              value={selectedOutcome}
              onChange={(e) => onOutcomeChange(e.target.value)}
              className="filter-select-control"
            >
              <option value="all">All Outcomes</option>
              {outcomeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Row 1, Col 3: Language */}
          <div className="filter-cell calllog-cell-language">
            <label htmlFor="filter-call-language" className="filter-control-label">
              LANGUAGE
            </label>
            <select
              id="filter-call-language"
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="filter-select-control"
            >
              <option value="all">All Languages</option>
              {distinctLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2, Col 1: Review Status */}
          <div className="filter-cell calllog-cell-review">
            <label htmlFor="filter-call-review" className="filter-control-label">
              REVIEW STATUS
            </label>
            <select
              id="filter-call-review"
              value={selectedReviewStatus}
              onChange={(e) => onReviewStatusChange(e.target.value)}
              className="filter-select-control"
            >
              <option value="all">All Review Status</option>
              <option value="reviewed">Reviewed</option>
              <option value="not_reviewed">Not reviewed</option>
            </select>
          </div>

          {/* Row 2, Col 2: Search caller or phone (Desktop & Tablet) */}
          <div className="filter-cell calllog-cell-search desktop-tablet-search-cell">
            <label htmlFor="calllog-search-input" className="filter-control-label">
              SEARCH CALLER OR PHONE
            </label>
            <div className="filter-search-wrapper">
              <Search size={18} className="filter-search-icon" aria-hidden="true" />
              <input
                id="calllog-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={resolvedSearchPlaceholder}
                className="filter-input-control search-input-control"
                aria-label="Search calls by caller name or phone digits"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="btn-clear-search-x"
                  aria-label="Clear search text"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2, Col 3: Flagged Only Toggle Button */}
          <div className="filter-cell calllog-cell-flagged">
            <label className="filter-control-label">NEEDS ATTENTION</label>
            <button
              type="button"
              onClick={onFlaggedToggle}
              className={`btn btn-calllog-flagged-toggle ${
                flaggedOnly ? 'toggle-active' : ''
              }`}
              aria-pressed={flaggedOnly}
            >
              <Flag
                size={16}
                className={flaggedOnly ? 'icon-flag-active' : 'icon-flag-muted'}
                aria-hidden="true"
              />
              <span>{flaggedOnly ? 'Flagged only (On)' : 'Flagged only'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
