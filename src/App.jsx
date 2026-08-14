import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navcomp from './components/Navcomp';
import NoteItemcomp from './components/NoteItemcomp';
import NoteState from './context/notes/NoteState';
import Authcomp from './components/Authcomp';
import { ToastContainer } from 'react-toastify';
import "./index.css";
import CommitsGraph from './components/CommitsGraph';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState(
    () => localStorage.getItem('tasknote_selected_priority') || 'All'
  );

  const handleSearchChange = (newValue, newPriority) => {
    setSearchQuery(newValue);
    if (newPriority !== undefined) {
      setSelectedPriority(newPriority);
      localStorage.setItem('tasknote_selected_priority', newPriority);
    }
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
                      setSearchQuery={setSearchQuery}
                      selectedPriority={selectedPriority} 
                    />
                  </>
                } 
              />

              <Route 
                exact 
                path="/commits" 
                element={
                  
                    <CommitsGraph/>
                  
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