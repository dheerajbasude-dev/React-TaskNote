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
    { label: 'High', value: 'High', color: '#f43f5e' },
    { label: 'Med', value: 'Medium', color: '#6366f1' },
    { label: 'Low', value: 'Low', color: '#10b981' },
  ];

  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

  if (!hasToken) return null;

  return (
    <header className="sleek-header">
      <div className="sleek-header-inner">
        {/* Brand */}
        <Link to="/" className="sleek-brand">
          <div className="sleek-brand-icon">
            <ion-icon name="checkbox"></ion-icon>
          </div>
          <span className="sleek-brand-name">TaskNote</span>
          {totalNotes > 0 && (
            <span className="sleek-stat-tag" title={`${completedNotes}/${totalNotes} done`}>
              {completedNotes}/{totalNotes}
            </span>
          )}
        </Link>

        {/* Search */}
        <div className="sleek-search-wrap">
          <ion-icon name="search-outline" class="sleek-search-ico"></ion-icon>
          <input
            ref={searchInputRef}
            type="text"
            className="sleek-search-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchQuery.trim()) setShowSuggestions(true);
            }}
            placeholder="Search tasks, links, subtasks... (/)"
          />
          {searchQuery ? (
            <button type="button" className="sleek-search-clear" onClick={clearSearch}>
              <ion-icon name="close-circle"></ion-icon>
            </button>
          ) : (
            <span className="sleek-search-kbd">/</span>
          )}

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="sleek-suggestions-popover">
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="sleek-suggestion-item"
                >
                  <ion-icon name="sparkles-outline"></ion-icon>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Tabs & Logout */}
        <div className="sleek-header-right">
          <div className="sleek-priority-tabs">
            {priorityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sleek-tab-btn ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
                onClick={() => handlePrioritySelect(opt.value)}
              >
                {opt.value !== 'All' && (
                  <span className="sleek-dot" style={{ backgroundColor: opt.color }}></span>
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="sleek-logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <ion-icon name="log-out-outline"></ion-icon>
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="sleek-mobile-toggle"
            onClick={toggleMenu}
            aria-label="Toggle Menu"
          >
            <ion-icon name={isMenuVisible ? 'close-outline' : 'menu-outline'}></ion-icon>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMenuVisible && (
        <div className="sleek-mobile-drawer">
          <div className="sleek-mobile-pills">
            {priorityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sleek-mobile-pill ${selectedPriority.toLowerCase() === opt.value.toLowerCase() ? 'active' : ''}`}
                onClick={() => handlePrioritySelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button type="button" className="sleek-mobile-logout" onClick={handleLogout}>
            <ion-icon name="log-out-outline"></ion-icon>
            <span>Logout</span>
          </button>
        </div>
      )}
    </header>
  );
};

export default Navcomp;
