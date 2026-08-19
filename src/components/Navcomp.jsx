import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Skeleton.css';

const Navcomp = ({ searchQuery, onSearchChange, selectedPriority }) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [suggestions] = useState(['/commits', 'High', 'Medium', 'Low']);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);

  const navigate = useNavigate();

  const handleHover = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  const colorStyle = {
    color: hovered ? '#bb00ff' : '#D462FF',
    textDecoration: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '1.25rem',
  };

  const toggleMenu = () => setIsMenuVisible(!isMenuVisible);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    window.location.reload();
    navigate('/auth');
  };

  const handlePriorityChange = (e) => {
    const newValue = e.target.value;
    localStorage.setItem('tasknote_selected_priority', newValue);
    onSearchChange(searchQuery, newValue);
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

  const handleSuggestionClick = (suggestion) => {
    if (['High', 'Medium', 'Low', 'All'].includes(suggestion)) {
      localStorage.setItem('tasknote_selected_priority', suggestion);
      onSearchChange(searchQuery, suggestion);
    } else {
      onSearchChange(suggestion, selectedPriority);
    }
    setShowSuggestions(false);
    setIsMenuVisible(false);
  };

  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  if (!hasToken) return null;

  return (
    <header className="header">
      <div className="header-top">
        <div className="header-logo">
          <Link
            style={colorStyle}
            onMouseEnter={handleHover}
            onMouseLeave={handleMouseLeave}
            to="/"
          >
            Tasks-note
          </Link>
        </div>

        <div className="header-toggle" onClick={toggleMenu}>
          <div className={`hamburger ${isMenuVisible ? 'is-active' : ''}`} id="hamburgerStyles">
            <span className="line"></span>
            <span className="line"></span>
            <span className="line"></span>
          </div>
        </div>
      </div>

      <nav className="navbar">
        <ul
          id="navigation"
          style={{ listStyleType: 'none', paddingInlineStart: 0 }}
          className={`navigation ${isMenuVisible ? 'navigation--visible' : ''}`}
        >
          {/* Search Box */}
          <li className="nav-item">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsMenuVisible(false);
              }}
              style={{ position: 'relative' }}
            >
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search"
                onFocus={() => {
                  if (searchQuery.trim()) setShowSuggestions(true);
                }}
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="suggestions-list">
                  {filteredSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="suggestion-item"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </form>
          </li>

          {/* Priority Select */}
          <li className="nav-item">
            <select
              className="select makeselect"
              value={selectedPriority}
              onChange={handlePriorityChange}
              style={{
                fontSize: '14px',
                appearance: 'none',
                outline: '0',
                cursor: 'pointer',
                background: '#ede7f6',
                color: '#673ab7',
                fontWeight: '700',
                padding: '6px 12px',
                border: '1px solid #d1c4e9',
                borderRadius: '12px',
              }}
            >
              <option value="All">All Priority</option>
              <option value="High">🔥 High</option>
              <option value="Medium">⚡ Medium</option>
              <option value="Low">🌱 Low</option>
            </select>
          </li>

          {/* Logout Button */}
          <li className="nav-item">
            <input
              onClick={handleLogout}
              className="logout"
              type="button"
              value="Logout"
            />
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Navcomp;
