import React from 'react'
import './commits.css'


const commits = [
    { label: "Issue of...", author: "Coder_Dheeraj", },
    { label: "Some issue naming issue", author: "Coder_Dheeraj" },
    { label: "Some more", author: "Coder_Dheeraj" },
    { label: "Some issues on more...", author: "Coder_Dheeraj" },
    { label: "last", author: "Coder_Dheeraj", active: true},
    { label: "fw", author: "Coder_Dheeraj" },
    { label: "gfg", author: "Coder_Dheeraj",  },
    { label: "ob", author: "Coder_Dheeraj" },
    { label: "Update touch", author: "Coder_Dheeraj" },
    { label: "Update Navcomp.js", author: "Coder_Dheeraj" },
    { label: "Updated the app", author: "Kishan" },
    {label: "Hello this is one first", author:"dummy"},
  ];

commits.reverse();

const CommitsGraph = () => {
    return (
        <div className="graph-center">
        <div className="commit-graph">
          {commits.map((commit, index) => (
            <div
              className="commit-node"
              key={index}
            >
              <div className="commit-circle"></div>
              <div className="commit-label">
                <span>{commit.label}</span>
                <small>{commit.author}</small>
              </div>
            </div>
          ))}
        </div>
        </div>
      );
}

export default CommitsGraph
