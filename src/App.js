import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navcomp from './components/Navcomp';
import NoteItemcomp from './components/NoteItemcomp';
import NoteState from './context/notes/NoteState';
import Authcomp from './components/Authcomp';
import { ToastContainer } from 'react-toastify';
import "./index.css";

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('All');

  const handleSearchChange = (newValue, newPriority) => {
    setSearchQuery(newValue);
    setSelectedPriority(newPriority);
  };

  return (
    <div className="App">
      <>
        <NoteState>
          <BrowserRouter>
            <Routes>
              <Route 
                exact 
                path="/" 
                element={
                  <>
                    <Navcomp 
                      searchQuery={searchQuery} 
                      onSearchChange={handleSearchChange} 
                      selectedPriority={selectedPriority} 
                    />
                    <NoteItemcomp 
                      searchQuery={searchQuery} 
                      selectedPriority={selectedPriority} 
                    />
                  </>
                } 
              />
              <Route exact path="/auth" element={<Authcomp />} />
            </Routes>
            <ToastContainer position="top-right" style={{ marginTop: "60px" }} />
          </BrowserRouter>
        </NoteState>
      </>
    </div>
  );
}

export default App;