import React, { useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import './Skeleton.css';

const Navcomp = ({ searchQuery, onSearchChange }) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [suggestions, setSuggestions] = useState(['/commits']);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const naviGate = useNavigate();

  const handleHover = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  const colorStyle = {
    color: hovered ? '#bb00ff' : '#D462FF',
    textDecoration: "none",
    cursor: "default"
  };

  const toggleMenu = () => setIsMenuVisible(!isMenuVisible);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
    naviGate("/auth");
  };

  const handlePriorityChange = (e) => {
    const newValue = e.target.value;
    setSelectedPriority(newValue);
    onSearchChange(searchQuery, newValue);
    setIsMenuVisible(false);
  };

  const handleSearchChange = (e) => {
    const newValue = e.target.value;
    onSearchChange(newValue, selectedPriority);
    setFilteredSuggestions(suggestions.filter((s) => s.toLowerCase().includes(newValue.toLowerCase())));
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion, selectedPriority);
    setShowSuggestions(false);
    setIsMenuVisible(false);
  };

  return (
    <>
      {localStorage.getItem("token") &&
        <header className="header">
          <div className="header-top">
            <div className='header-logo'>
              <Link style={colorStyle} onMouseEnter={handleHover} onMouseLeave={handleMouseLeave} to="/">Tasks-note</Link>
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
            <ul id="navigation" style={{ listStyleType: 'none', paddingInlineStart: 0 }} className={`navigation ${isMenuVisible ? 'navigation--visible' : ''}`}>
              <li className="nav-item">
                <form onSubmit={(e) => { e.preventDefault(); setIsMenuVisible(false); }}>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search"
                  />
                  {showSuggestions && (
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
              <li className="nav-item">
                <select className="select makeselect"
                  value={selectedPriority}
                  onChange={handlePriorityChange}
                  style={{
                    fontSize: "15px", appearance: "none", outline: "0",
                    width: "68px", cursor: 'pointer', background: "#C2DFFF",
                    padding: "6px", border: "none", borderRadius: "10px"
                  }}
                >
                  <option value="All">Priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </li>
              <li className="nav-item">
                <b><input onClick={handleLogout} className="logout" type="button" value="Logout" /></b>
              </li>
            </ul>
          </nav>
        </header>
      }
    </>
  );
}

export default Navcomp;
