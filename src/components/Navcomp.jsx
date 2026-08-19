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

  // Productivity metrics
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
    { label: 'Med', value: 'Medium', color: '#3b82f6' },
    { label: 'Low', value: 'Low', color: '#10b981' },
  ];

  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

  if (!hasToken) return null;

  return (
    <header className="compact-header">
      <div className="compact-header-inner">
        {/* Brand Group */}
        <div className="compact-brand-group">
          <Link to="/" className="compact-brand-link">
            <div className="compact-brand-icon">
              <ion-icon name="checkbox"></ion-icon>
            </div>
            <span className="compact-brand-title">TaskNote</span>
          </Link>

          {/* Compact Productivity Pill */}
          {totalNotes > 0 && (
            <div className="compact-stat-pill" title={`${completedNotes} of ${totalNotes} done`}>
              <span className="stat-pill-num">{completedNotes}/{totalNotes}</span>
              <div className="stat-pill-mini-track">
                <div className="stat-pill-mini-bar" style={{ width: `${completionPercentage}%` }}></div>
              </div>
              <span className="stat-pill-pct">{completionPercentage}%</span>
            </div>
          )}
        </div>

        {/* Center Search Input */}
        <div className="compact-search-box">
          <ion-icon name="search-outline" class="compact-search-icon"></ion-icon>
          <input
            ref={searchInputRef}
            type="text"
            className="compact-search-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchQuery.trim()) setShowSuggestions(true);
            }}
            placeholder="Search notes, subtasks... (/)"
          />
          {searchQuery ? (
            <button
              type="button"
              className="compact-search-clear"
              onClick={clearSearch}
              title="Clear search"
            >
              <ion-icon name="close-circle"></ion-icon>
            </button>
          ) : (
            <span className="compact-search-kbd">/</span>
          )}

          {/* Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="compact-suggestions-popover">
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="compact-suggestion-item"
                >
                  <ion-icon name="sparkles-outline"></ion-icon>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Filter Pills */}
        <div className="compact-actions-group">
          <div className="compact-priority-segmented">
            {priorityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`compact-priority-btn ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
                onClick={() => handlePrioritySelect(opt.value)}
              >
                {opt.value !== 'All' && (
                  <span className="compact-dot" style={{ backgroundColor: opt.color }}></span>
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Logout */}
          <button
            type="button"
            className="compact-logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <ion-icon name="log-out-outline"></ion-icon>
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          className={`compact-mobile-btn ${isMenuVisible ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle Menu"
        >
          <ion-icon name={isMenuVisible ? 'close-outline' : 'menu-outline'}></ion-icon>
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMenuVisible && (
        <div className="compact-mobile-drawer">
          <div className="compact-mobile-drawer-inner">
            <div className="compact-mobile-priorities">
              <span className="mobile-label">Priority:</span>
              <div className="mobile-pills-row">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mobile-pill-btn ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
                    onClick={() => handlePrioritySelect(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {totalNotes > 0 && (
              <div className="mobile-stat-row">
                <span>Progress: <strong>{completedNotes}/{totalNotes} tasks</strong> ({completionPercentage}%)</span>
              </div>
            )}

            <button type="button" className="mobile-logout-full" onClick={handleLogout}>
              <ion-icon name="log-out-outline"></ion-icon>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navcomp;
