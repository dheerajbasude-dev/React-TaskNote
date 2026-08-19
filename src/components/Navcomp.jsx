import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import noteContext from '../context/notes/noteContext';
import './Note.css';

const Navcomp = ({ searchQuery, onSearchChange, selectedPriority }) => {
  const [suggestions] = useState(['/commits', 'High', 'Medium', 'Low']);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);

  const context = useContext(noteContext);
  const { notes } = context || { notes: [] };
  const navigate = useNavigate();

  const totalNotes = notes ? notes.length : 0;
  const completedNotes = notes ? notes.filter((n) => n.completed).length : 0;

  // Global '/' hotkey to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (
        e.key === '/' &&
        document.activeElement !== searchInputRef.current &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    window.location.reload();
    navigate('/auth');
  };

  const handlePrioritySelect = (priority) => {
    localStorage.setItem('tasknote_selected_priority', priority);
    onSearchChange(searchQuery, priority);
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
    searchInputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion) => {
    if (['High', 'Medium', 'Low'].includes(suggestion)) {
      handlePrioritySelect(suggestion);
    } else {
      onSearchChange(suggestion, selectedPriority);
    }
    setShowSuggestions(false);
  };

  const priorityOptions = [
    { label: 'All',  value: 'All',    color: '#6366f1' },
    { label: 'High', value: 'High',   color: '#e11d48' },
    { label: 'Med',  value: 'Medium', color: '#7c3aed' },
    { label: 'Low',  value: 'Low',    color: '#059669' },
  ];

  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  if (!hasToken) return null;

  return (
    <header className="nav-root">
      <div className="nav-inner">
        {/* Brand */}
        <Link to="/" className="nav-brand">
          <div className="nav-brand-mark">
            <ion-icon name="checkbox-outline"></ion-icon>
          </div>
          <span className="nav-brand-text">TaskNote</span>
          {totalNotes > 0 && (
            <span className="nav-task-pill" title={`${completedNotes}/${totalNotes} completed`}>
              {completedNotes}/{totalNotes}
            </span>
          )}
        </Link>

        {/* Search */}
        <div className="nav-search">
          <span className="nav-search-icon">
            <ion-icon name="search-outline"></ion-icon>
          </span>
          <input
            ref={searchInputRef}
            type="text"
            className="nav-search-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => { if (searchQuery.trim()) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search tasks... (/)"
          />
          <div className="nav-search-right">
            {searchQuery ? (
              <button type="button" className="nav-clear-btn" onClick={clearSearch}>
                <ion-icon name="close-circle"></ion-icon>
              </button>
            ) : (
              <span className="nav-kbd">/</span>
            )}
          </div>

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="nav-suggestions">
              {filteredSuggestions.map((s, i) => (
                <div key={i} className="nav-suggestion-item" onMouseDown={() => handleSuggestionClick(s)}>
                  <ion-icon name="sparkles-outline"></ion-icon>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority tabs — desktop only */}
        <div className="nav-priority-tabs">
          {priorityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`nav-tab ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
              onClick={() => handlePrioritySelect(opt.value)}
            >
              {opt.value !== 'All' && (
                <span className="nav-tab-dot" style={{ backgroundColor: opt.color }}></span>
              )}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Logout */}
        <button type="button" className="nav-logout" onClick={handleLogout} title="Logout">
          <ion-icon name="log-out-outline"></ion-icon>
        </button>
      </div>

      {/* Mobile priority bar — scrollable row, always visible below nav */}
      <div className="nav-mobile-bar">
        {priorityOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`nav-mobile-tab ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
            onClick={() => handlePrioritySelect(opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <button type="button" className="nav-mobile-tab" onClick={handleLogout} style={{ color: '#e11d48' }}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navcomp;
