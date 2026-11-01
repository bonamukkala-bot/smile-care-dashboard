import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertCircle,
  CalendarCheck,
  Calendar,
  PhoneCall,
  Clock,
} from 'lucide-react'
import BrandMark from './BrandMark'
import { getClinicStatusIST } from '../lib/helpers'

export default function Sidebar({ openAttentionCount = 0, hasEmergency = false, todayBookingsCount = 0 }) {
  const [clinicStatus, setClinicStatus] = useState(() => getClinicStatusIST())

  useEffect(() => {
    // Refresh clinic hours status every 60s
    const timer = setInterval(() => {
      setClinicStatus(getClinicStatusIST())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <BrandMark size={38} />
        <div className="brand-text-block">
          <span className="brand-title">Smile Care</span>
          <span className="brand-subtitle">Dental Clinic</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
        >
          <LayoutDashboard size={20} className="sidebar-icon" />
          <span className="link-text">Dashboard</span>
        </NavLink>

        <NavLink
          to="/attention"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
        >
          <AlertCircle size={20} className="sidebar-icon" />
          <span className="link-text">Needs Attention</span>
          {openAttentionCount > 0 && (
            <span
              className={`nav-badge ${
                hasEmergency ? 'nav-badge-emergency' : 'nav-badge-attention'
              }`}
            >
              {openAttentionCount}
            </span>
          )}
        </NavLink>

        <NavLink
          to="/bookings"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
        >
          <CalendarCheck size={20} className="sidebar-icon" />
          <span className="link-text">Today's Bookings</span>
          {todayBookingsCount > 0 && (
            <span className="nav-badge nav-badge-bookings">{todayBookingsCount}</span>
          )}
        </NavLink>

        <NavLink
          to="/appointments"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
        >
          <Calendar size={20} className="sidebar-icon" />
          <span className="link-text">Appointments</span>
        </NavLink>

        <NavLink
          to="/calls"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
        >
          <PhoneCall size={20} className="sidebar-icon" />
          <span className="link-text">Call Log</span>
        </NavLink>
      </nav>

      {/* Clinic Hours Card at bottom */}
      <div className="sidebar-footer">
        <div className="clinic-hours-card">
          <div className="hours-header">
            <span className="hours-title">
              <Clock size={15} /> Clinic Hours
            </span>
            <span className={`status-pill status-pill-${clinicStatus.color}`}>
              <span className="status-dot" />
              {clinicStatus.status}
            </span>
          </div>
          <p className="hours-schedule">
            Mon–Sat: 10:00 AM–1:30 PM &amp; 5:00–8:30 PM
          </p>
          <p className="hours-subnote">Closed Sundays</p>
        </div>
      </div>
    </aside>
  )
}

