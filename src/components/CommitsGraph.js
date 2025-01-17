import React, { useState, useEffect, useContext } from "react";
import "./commits.css";
import { Link, useNavigate } from "react-router-dom";
import noteContext from "../context/notes/noteContext";
import { DotPulse } from '@uiball/loaders';

const CommitsGraph = () => {
  const [commit, setCommit] = useState({ label: "", author: "" });
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBtnLoading, setIsBtnLoading] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false); // Track confirmation state
  let navigate = useNavigate();

  // Validate email on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("email");
    if (storedEmail !== "commits@gmail.com") {
      navigate("/"); // Redirect unauthorized users
    }
  }, [navigate]);

  // Context API from the express API we have created
  const context = useContext(noteContext);
  const { commits, getCommits, addCommit, deleteCommit } = context;

  useEffect(() => {
    const fetchCommits = async () => {
      setIsLoading(true);
      await getCommits(); // Fetch commits from the API
      setIsLoading(false);
    };

    fetchCommits();
    // eslint-disable-next-line
  }, []);

  const handleAddCommit = async (e) => {
    e.preventDefault();
    setIsBtnLoading(true);
    if (commit.label.trim() && commit.author.trim()) {
      await addCommit(commit.label, commit.author); // Add commit via context
      setCommit({ label: "", author: "" }); // Reset form fields
    }
    setIsBtnLoading(false);
  };

  const truncateLabel = (label) => {
    return label.length > 30 ? label.slice(0, 30) + "..." : label;
  };

  const handleRightClick = (e, commit, index) => {
    e.preventDefault();
  
    // Immediately show the delete confirmation modal on right-click
    setSelectedCommit({ ...commit, index });
    setModalVisible(true); // Open the modal for deleting
    setIsConfirmingDelete(false); // Reset to the normal modal (not in confirmation mode)
  };

  const handleDeleteCommit = async (e) => {
    e.preventDefault();
    if (isConfirmingDelete) {
      const commitToDelete = selectedCommit; // Ensure the commit to delete is the one selected
      if (commitToDelete) {
        await deleteCommit(commitToDelete._id); // Delete commit via context
        setModalVisible(false); // Close modal after deletion
      }
    } else {
      setIsConfirmingDelete(true); // Show confirmation buttons
    }
  };

  return (
    <div>
      <div className="page-container">
        {/* Form Section */}
        <form className="form-commit" onSubmit={handleAddCommit}>
          <h1 className="head-commit">Commits</h1>
          <div className="form-group">
            <input
              type="text"
              id="label"
              value={commit.label}
              onChange={(e) => setCommit({ ...commit, label: e.target.value })}
              required
              placeholder="Enter label"
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              id="author"
              value={commit.author}
              onChange={(e) => setCommit({ ...commit, author: e.target.value })}
              required
              placeholder="Enter author"
            />
          </div>
          {isBtnLoading ? (
            <div className="loader-btn-add-task-commits">
              <button disabled={true} style={{ background: "#dfe1e9" }}>
                <DotPulse color="#007aff" />
              </button>
            </div>
          ) : (
            <>
              <button type="submit" className="commit-form-btn">Add Commit</button>
              <Link to="/" className="notes-link"><span>Go to Notes</span></Link>
            </>
          )}
        </form>

        {/* Scrollable Commit Graph Section */}
        <div className="graph-center">
          {isLoading ? (
            <p style={{ color: "white" }}><i><b>Loading commits...</b></i></p>
          ) : (
            <div className="commit-graph">
              {commits
                .slice()
                .reverse() // Reverse the array without mutating the original
                .map((commit, index) => (
                  <div
                    className="commit-node"
                    key={index}
                    onContextMenu={(e) => handleRightClick(e, commit, index)} // Add right-click handler
                  >
                    <div className="commit-circle"></div>
                    <div className="commit-label">
                      <span>{truncateLabel(commit.label)}</span>
                      <small>{truncateLabel(commit.author)}</small>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Section */}
      {modalVisible && selectedCommit && (
        <div className="modal-overlay" onClick={() => setModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ textAlign: "center" }}>Commit Details</h2>
            <p>{isConfirmingDelete ? <>Label : <b>{selectedCommit.label}</b></> : <><b>Label :</b> {selectedCommit.label}</>}</p>
            <p>{isConfirmingDelete ? <>Author : <b>{selectedCommit.author}</b></> : <><b>Author :</b> {selectedCommit.author}</>}</p>
            <p>{isConfirmingDelete ? <>Date :  <b>{selectedCommit.date}</b></> : <><b>Date :</b> {selectedCommit.date}</>}</p>

            
            {/* Display Delete Confirmation or Normal Buttons */}
            <div className="modal-buttons">
              {isConfirmingDelete ? (
                <>
                  <button className="delete-btn" onClick={handleDeleteCommit}>Confirm Delete</button>
                  <button className="close-btn" onClick={() => setModalVisible(false)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="delete-btn" onClick={handleDeleteCommit}>Delete Commit</button>
                  <button className="close-btn" onClick={() => setModalVisible(false)}>Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitsGraph;
