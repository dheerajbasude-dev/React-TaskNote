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
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

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

  const handleCommitClick = (commit, index) => {
    setSelectedCommit({ ...commit, index });
    setModalVisible(true);
  };

  const truncateLabel = (label) => {
    return label.length > 30 ? label.slice(0, 30) + "..." : label;
  };

  const handleRightClick = (e, commit, index) => {
    e.preventDefault();
    const xPos = e.clientX;
    const yPos = e.clientY;
    const menuWidth = 150; // Adjust according to the menu width
    const menuHeight = 50; // Adjust according to the menu height
  
    const xPosition = xPos + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : xPos;
    const yPosition = yPos + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : yPos;
  
    setContextMenuPosition({ x: xPosition, y: yPosition });
    setSelectedCommit({ ...commit, index });
    setShowContextMenu(true);
  };
  

  const handleDeleteCommit = async (e) => {
    e.preventDefault();
    const commitToDelete = selectedCommit; // Ensure the commit to delete is the one selected
    if (commitToDelete) {
      await deleteCommit(commitToDelete._id); // Delete commit via context
      setShowContextMenu(false); // Close context menu after deletion
    }
  };

  const closeContextMenu = () => {
    setShowContextMenu(false); // Close context menu when clicked outside
  };

  return (
    <div onClick={closeContextMenu}>
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
                    onClick={() => handleCommitClick(commit, index)}
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
            <p><b>Label :</b> {selectedCommit.label}</p>
            <p><b>Author :</b> {selectedCommit.author}</p>
            <p><b>Date :</b> {selectedCommit.date}</p>
            <div className="modal-close-btn">
              <button onClick={() => setModalVisible(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu Section */}
      {showContextMenu && (
        <div
          className="context-menu"
          style={{ top: `${contextMenuPosition.y}px`, left: `${contextMenuPosition.x}px` }}
        >
          <button className="delete-option" onClick={handleDeleteCommit}>Delete Commit</button>
        </div>
      )}
    </div>
  );
};

export default CommitsGraph;
