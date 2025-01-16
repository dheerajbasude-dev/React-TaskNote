import React, { useState, useEffect } from "react";
import "./commits.css";
import { Link, useNavigate } from "react-router-dom";

const initialCommits = [
  { label: "Issue of...", author: "Coder_Dheeraj", date: "2025-01-16" },
  { label: "Some issue naming issue", author: "Coder_Dheeraj", date: "2025-01-15" },
  { label: "Some more", author: "Coder_Dheeraj", date: "2025-01-14" },
  { label: "Some issues on more...", author: "Coder_Dheeraj", date: "2025-01-13" },
  { label: "last", author: "Coder_Dheeraj", active: true, date: "2025-01-12" },
  { label: "fw", author: "Coder_Dheeraj", date: "2025-01-11" },
  { label: "gfg", author: "Coder_Dheeraj", date: "2025-01-10" },
  { label: "ob", author: "Coder_Dheeraj", date: "2025-01-09" },
  { label: "Update touch", author: "Coder_Dheeraj", date: "2025-01-08" },
  { label: "Update Navcomp.js", author: "Coder_Dheeraj", date: "2025-01-07" },
  { label: "Updated the app", author: "Kishan", date: "2025-01-06" },
  { label: "Hello this is one first", author: "dummy", date: "2025-01-05" },
];

const CommitsGraph = () => {
  const [commits, setCommits] = useState([...initialCommits.reverse()]);
  const [label, setLabel] = useState("");
  const [author, setAuthor] = useState("");
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  let navigate = useNavigate();

  // Validate email on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("email"); // Retrieve email from localStorage
    if (storedEmail !== "commits@gmail.com") {
      navigate("/"); // Redirect unauthorized users
    }
  }, [navigate]);

  const handleAddCommit = (e) => {
    e.preventDefault();
    if (label.trim() && author.trim()) {
      const now = new Date();
      const formattedDate = `${now.toLocaleDateString("en-US", {
        weekday: "short",
      })} ${now.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} ${now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
  
      setCommits([{ label, author, date: formattedDate }, ...commits]);
      setLabel("");
      setAuthor("");
    }
  };
  

  const handleCommitClick = (commit, index) => {
    setSelectedCommit({ ...commit, index });
    setModalVisible(true);
  };
  
  

  const truncateLabel = (label) => {
    return label.length > 30 ? label.slice(0, 30) + "..." : label;
  };
  

  return (
    <>
      <div className="page-container">
        {/* Form Section */}
        <form className="form-commit" onSubmit={handleAddCommit}>
          <h1 className="head-commit">Commits</h1>
          <div className="form-group">
            <input
              type="text"
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Enter label"
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              placeholder="Enter author"
            />
          </div>
          <button type="submit" className="commit-form-btn">Add Commit</button>
          <Link to="/" className="notes-link"><span>Go to Notes</span></Link>
        </form>

        {/* Scrollable Commit Graph Section */}
        <div className="graph-center">
          <div className="commit-graph">
            {commits.map((commit, index) => (
              <div
                className="commit-node"
                key={index}
                onClick={() => handleCommitClick(commit)}
              >
                <div className="commit-circle"></div>
                <div className="commit-label">
                  <span>{truncateLabel(commit.label)}</span>
                  <small>{truncateLabel(commit.author)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Section */}
      {modalVisible && selectedCommit && (
        <div className="modal-overlay" onClick={() => setModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{textAlign:"center"}}>Commit Details</h2>
            <p><b>Label :</b> {selectedCommit.label}</p>
            <p><b>Author :</b> {selectedCommit.author}</p>
            <p><b>Date :</b> {selectedCommit.date}</p>
            <div className="modal-close-btn">
            <button onClick={() => setModalVisible(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommitsGraph;
