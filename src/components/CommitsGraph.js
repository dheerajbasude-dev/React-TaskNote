import React, { useState } from "react";
import "./commits.css";
import {Link} from "react-router-dom";

const initialCommits = [
  { label: "Issue of...", author: "Coder_Dheeraj" },
  { label: "Some issue naming issue", author: "Coder_Dheeraj" },
  { label: "Some more", author: "Coder_Dheeraj" },
  { label: "Some issues on more...", author: "Coder_Dheeraj" },
  { label: "last", author: "Coder_Dheeraj", active: true },
  { label: "fw", author: "Coder_Dheeraj" },
  { label: "gfg", author: "Coder_Dheeraj" },
  { label: "ob", author: "Coder_Dheeraj" },
  { label: "Update touch", author: "Coder_Dheeraj" },
  { label: "Update Navcomp.js", author: "Coder_Dheeraj" },
  { label: "Updated the app", author: "Kishan" },
  { label: "Hello this is one first", author: "dummy" },
];

const CommitsGraph = () => {
  const [commits, setCommits] = useState([...initialCommits.reverse()]);
  const [label, setLabel] = useState("");
  const [author, setAuthor] = useState("");

  const handleAddCommit = (e) => {
    e.preventDefault();
    if (label.trim() && author.trim()) {
      setCommits([{ label, author }, ...commits]);
      setLabel("");
      setAuthor("");
    }
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
            <div className="commit-node" key={index}>
              <div className="commit-circle"></div>
              <div className="commit-label">
                <span>{commit.label}</span>
                <small>{commit.author}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
};

export default CommitsGraph;
