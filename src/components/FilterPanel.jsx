import { useState } from 'react'
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, X } from 'lucide-react'
import { formatAppointmentStatus, formatDoctorName } from '../lib/helpers'

export default function FilterPanel({
  filterStatus,
  onStatusChange,
  filterSource,
  onSourceChange,
  filterDoctor,
  onDoctorChange,
  doctors = {},
  searchQuery,
  onSearchChange,
  showCancelled,
  onShowCancelledChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  statusOptions = [],
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  return (
    <section className="card filter-panel-card" aria-label="Appointment Filters">
      {/* Search Input (Always visible on all screen sizes) */}
      <div className="filter-search-row">
        <div className="filter-search-wrapper">
          <Search size={18} className="search-field-icon" aria-hidden="true" />
          <input
            id="appointment-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or digits..."
            className="filter-input search-input-field"
            aria-label="Search appointments by patient name or phone number digits"
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

        {/* Mobile Toggle Button (only on phone < 640px) */}
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className={`btn btn-secondary filter-mobile-toggle-btn ${
            mobileExpanded || activeFilterCount > 0 ? 'toggle-active' : ''
          }`}
          aria-expanded={mobileExpanded}
          aria-controls="filter-collapsible-controls"
          aria-label="Toggle filter options"
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="filter-count-badge" aria-label={`${activeFilterCount} active filters`}>
              {activeFilterCount}
            </span>
          )}
          {mobileExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Grid of Dropdowns & Controls (Always visible desktop; collapsible on phone) */}
      <div
        id="filter-collapsible-controls"
        className={`filter-controls-grid ${mobileExpanded ? 'grid-expanded' : 'grid-collapsed'}`}
      >
        {/* Status Select */}
        <div className="filter-control-item">
          <label htmlFor="filter-status-select" className="filter-label-clean">
            Status
          </label>
          <select
            id="filter-status-select"
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="filter-select-clean"
          >
            <option value="all">All Statuses</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {formatAppointmentStatus(st)}
              </option>
            ))}
          </select>
        </div>

        {/* Source Select */}
        <div className="filter-control-item">
          <label htmlFor="filter-source-select" className="filter-label-clean">
            Source
          </label>
          <select
            id="filter-source-select"
            value={filterSource}
            onChange={(e) => onSourceChange(e.target.value)}
            className="filter-select-clean"
          >
            <option value="all">All Sources</option>
            <option value="ai">AI booked</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        {/* Doctor Select */}
        <div className="filter-control-item">
          <label htmlFor="filter-doctor-select" className="filter-label-clean">
            Doctor
          </label>
          <select
            id="filter-doctor-select"
            value={filterDoctor}
            onChange={(e) => onDoctorChange(e.target.value)}
            className="filter-select-clean"
          >
            <option value="all">All Doctors</option>
            {Object.entries(doctors).map(([id, name]) => (
              <option key={id} value={id}>
                {formatDoctorName(name)}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle Show Cancelled */}
        <div className="filter-control-item toggle-control-item">
          <label className="toggle-label-clean">
            <span className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => onShowCancelledChange(e.target.checked)}
                className="toggle-native-checkbox"
                aria-label="Show cancelled bookings"
              />
              <span className="toggle-switch-slider" aria-hidden="true" />
            </span>
            <span className="toggle-text-label">Show cancelled</span>
          </label>
        </div>

        {/* Clear Filters Button (only when any filter is active) */}
        {hasActiveFilters && (
          <div className="filter-clear-item">
            <button
              type="button"
              onClick={onClearFilters}
              className="btn btn-ghost btn-clear-filters-clean"
              aria-label="Reset all filters"
            >
              Clear filters ({activeFilterCount})
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

