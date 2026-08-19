import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import noteContext from '../context/notes/noteContext';
import './Skeleton.css';

const Navcomp = ({ searchQuery, onSearchChange, selectedPriority }) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [suggestions] = useState(['/commits', 'High', 'Medium', 'Low']);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);

  const context = useContext(noteContext);
  const { notes } = context || { notes: [] };

  const navigate = useNavigate();

  // Calculate quick productivity metrics
  const totalNotes = notes ? notes.length : 0;
  const completedNotes = notes ? notes.filter((n) => n.completed).length : 0;
  const completionPercentage = totalNotes > 0 ? Math.round((completedNotes / totalNotes) * 100) : 0;

  // Global hotkey to focus search bar on '/'
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const toggleMenu = () => setIsMenuVisible(!isMenuVisible);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    window.location.reload();
    navigate('/auth');
  };

  const handlePrioritySelect = (priority) => {
    localStorage.setItem('tasknote_selected_priority', priority);
    onSearchChange(searchQuery, priority);
    setIsMenuVisible(false);
  };

  const handleSearchChange = (e) => {
    const newValue = e.target.value;
    onSearchChange(newValue, selectedPriority);
    if (newValue.trim()) {
      setFilteredSuggestions(
        suggestions.filter((s) => s.toLowerCase().includes(newValue.toLowerCase()))
      );
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    onSearchChange('', selectedPriority);
    setShowSuggestions(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion === 'High' || suggestion === 'Medium' || suggestion === 'Low') {
      handlePrioritySelect(suggestion);
    } else {
      onSearchChange(suggestion, selectedPriority);
    }
    setShowSuggestions(false);
    setIsMenuVisible(false);
  };

  const priorityOptions = [
    { label: 'All', value: 'All', color: '#6366f1' },
    { label: 'High', value: 'High', color: '#ef4444' },
    { label: 'Medium', value: 'Medium', color: '#3b82f6' },
    { label: 'Low', value: 'Low', color: '#10b981' },
  ];

  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

  if (!hasToken) return null;

  return (
    <header className="modern-header">
      <div className="header-inner">
        {/* Brand Logo & Title */}
        <div className="header-brand-group">
          <Link to="/" className="brand-link">
            <div className="brand-icon-wrapper">
              <ion-icon name="checkbox"></ion-icon>
            </div>
            <div className="brand-text-wrapper">
              <span className="brand-title">TaskNote</span>
              <span className="brand-badge">PRO</span>
            </div>
          </Link>

          {/* Productivity Stats Pill on Desktop */}
          {totalNotes > 0 && (
            <div className="productivity-stat-pill" title={`${completedNotes} of ${totalNotes} tasks completed (${completionPercentage}%)`}>
              <div className="productivity-stat-text">
                <span className="stat-highlight">{completedNotes}/{totalNotes}</span>
                <span className="stat-label">Done</span>
              </div>
              <div className="productivity-progress-track">
                <div
                  className="productivity-progress-bar"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <span className="stat-percentage">{completionPercentage}%</span>
            </div>
          )}
        </div>

        {/* Center Search Input */}
        <div className="header-search-container">
          <div className="search-input-wrapper">
            <ion-icon name="search-outline" class="search-icon"></ion-icon>
            <input
              ref={searchInputRef}
              type="text"
              className="modern-search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim()) setShowSuggestions(true);
              }}
              placeholder="Search notes, subtasks, or /commits..."
            />
            {searchQuery ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={clearSearch}
                title="Clear search"
              >
                <ion-icon name="close-circle"></ion-icon>
              </button>
            ) : (
              <span className="search-shortcut-hint" title="Press '/' to search">/</span>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="modern-suggestions-dropdown">
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="modern-suggestion-item"
                >
                  <ion-icon name="sparkles-outline"></ion-icon>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Filter Pills Desktop */}
        <div className="header-filters-group">
          <div className="priority-pill-selector">
            {priorityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`priority-filter-btn ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
                onClick={() => handlePrioritySelect(opt.value)}
              >
                {opt.value !== 'All' && (
                  <span className="priority-dot" style={{ backgroundColor: opt.color }}></span>
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Logout & Action Buttons */}
          <div className="header-user-actions">
            <button
              type="button"
              className="modern-logout-btn"
              onClick={handleLogout}
              title="Logout from TaskNote"
            >
              <ion-icon name="log-out-outline"></ion-icon>
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className={`mobile-menu-toggle ${isMenuVisible ? 'is-open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
        </button>
      </div>

      {/* Mobile Drawer Navigation */}
      <div className={`mobile-drawer ${isMenuVisible ? 'is-visible' : ''}`}>
        <div className="mobile-drawer-inner">
          {/* Mobile Search */}
          <div className="mobile-search-wrapper">
            <ion-icon name="search-outline"></ion-icon>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search tasks..."
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch}>
                <ion-icon name="close-circle"></ion-icon>
              </button>
            )}
          </div>

          {/* Mobile Priority Pills */}
          <div className="mobile-priority-section">
            <span className="mobile-section-label">Filter Priority:</span>
            <div className="mobile-priority-grid">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`mobile-priority-chip ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
                  onClick={() => handlePrioritySelect(opt.value)}
                >
                  {opt.value !== 'All' && (
                    <span className="priority-dot" style={{ backgroundColor: opt.color }}></span>
                  )}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Productivity Stat */}
          {totalNotes > 0 && (
            <div className="mobile-stat-banner">
              <ion-icon name="trending-up-outline"></ion-icon>
              <span>Productivity: <strong>{completedNotes}/{totalNotes} tasks</strong> ({completionPercentage}%)</span>
            </div>
          )}

          {/* Mobile Logout */}
          <div className="mobile-drawer-footer">
            <button type="button" className="mobile-logout-btn" onClick={handleLogout}>
              <ion-icon name="log-out-outline"></ion-icon>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navcomp;

