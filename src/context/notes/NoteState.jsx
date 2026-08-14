import React from "react";
import NoteContext from "./noteContext";
import { useState } from "react";

const NoteState = (props) => {
    /*This is being used by practice*/ 
    // const s1 = {
    //     "name":"Dheeraj",
    //     "role":"Jobless"
    // }

    // const [state, setState] = useState(s1);

    // const update = () => {
    //     setTimeout(() => {
    //         setState({
    //             "name":"Yuvraj",
    //             "role":"No tension faltu"
    //         })
    //     }, 1000);
    // }
    
    // return(
    //     <NoteContext.Provider value={{state:state, update:update}}>
    //         {props.children}
    //     </NoteContext.Provider>

    // )

    // Setting the local host url that is being used in the fetching the api call
    const host = import.meta.env.VITE_API_HOST;
    const host1 = import.meta.env.VITE_COMMITS_HOST; //for commits
    const notesInitial = []  // All notes are going to here
    const commitsInitial = [] // All commits are going to here

      // Passing the notes state to the notesInitial
      const [notes, setNotes] = useState(notesInitial);
      const[commits, setCommits] = useState(commitsInitial); // for commits
      const [filteredNotes, setFilteredNotes] = useState([]); // filtred searching

       // Get all notes
       const getNotes = async () =>{
        // Todo api call, fetching all notes with a user tokens
        try {
        const response = await fetch(`${host}/api/notes/fetchnotes` , {
          method: "get",
          headers: {
            'Content-Type':'application/json',
            'auth-token':localStorage.getItem('token')
          }
        });

        if (response.ok) {
          const json = await response.json();
          setNotes(json);
        } else {
          console.error("Failed to add note:", response.status);
        }
      } catch(error) {
        console.error("Error adding note:", error);
      }
    }

    // Get all commits
    const getCommits = async () =>{
      // Todo api call, fetching all commits with a user tokens
      try {
      const response = await fetch(`${host1}/api/commits/fetchcommits` , {
        method: "get",
        headers: {
          'Content-Type':'application/json',
          'auth-token': import.meta.env.VITE_COMMITS_AUTH_TOKEN
        }
      });

      if (response.ok) {
        const json = await response.json();
        setCommits(json);
      } else {
        console.error("Failed to add commit:", response.status);
      }
    } catch(error) {
      console.error("Error adding commit:", error);
    }
  }
       


      // Add a note
      const addNote = async (title, description, tag) => {
        try {
          const response = await fetch(`${host}/api/notes/addnote`, {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
              'auth-token': localStorage.getItem('token')
            },
            body: JSON.stringify({ title, description, tag })
          });

          if (response.ok) {
            const savedNote = await response.json();
            setNotes((prevNotes) => prevNotes.concat(savedNote));
            return savedNote;
          } else {
            console.error("Failed to add note:", response.status);
          }
        } catch(error) {
          console.error("Error adding note:", error);
        }
      };


      //Add a commit
       const addCommit = async (label, author) =>{
        try {
        const response = await fetch(`${host1}/api/commits/addcommit` , {
          method: "POST",
          headers: {
            'Content-Type':'application/json',
            'auth-token': import.meta.env.VITE_COMMITS_AUTH_TOKEN
          },
          body:JSON.stringify({label, author})
        });

        if (response.ok) {
          await getCommits();
          const commit = await response.json();
          setCommits(commits.concat(commit));
        } else {
          console.error("Failed to add commit:", response.status);
        }
      } catch(error) {
        console.error("Error adding commit:", error);
      }};


    // Update a note's completed status, by requesting put 
    const updateNoteCompletedStatus = async (id, completed) => {
      try {
        const response = await fetch(`${host}/api/notes/completenote/${id}`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json',
            'auth-token': localStorage.getItem('token')
          },
          body: JSON.stringify({ completed })
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.note) {
            setNotes((prevNotes) =>
              prevNotes.map((note) =>
                note._id === id ? { ...note, ...data.note, completed } : note
              )
            );
          }
        } else {
          console.error("Failed to update note completion status:", response.status);
        }
      } catch (error) {
        console.error("Error updating note completion status:", error);
      }
    };

      
      // Edit a note
      const editNote = async (id, title, description, tag) => {
        try {
          const response = await fetch(`${host}/api/notes/updatenote/${id}`, {
            method: "PUT",
            headers: {
              'Content-Type': 'application/json',
              'auth-token': localStorage.getItem('token')
            },
            body: JSON.stringify({ title, description, tag })
          });

          if (response.ok) {
            const json = await response.json();
            const updated = json.note || {};
            setNotes((prevNotes) =>
              prevNotes.map((item) =>
                item._id === id
                  ? {
                      ...item,
                      ...updated,
                      title,
                      description,
                      tag,
                      updatedDate: updated.updatedDate || item.updatedDate,
                      isEdited: true,
                    }
                  : item
              )
            );
            return updated;
          } else {
            console.error("Failed to edit note:", response.status);
          }
        } catch (error) {
          console.error("Error editing note:", error);
        }
      };
      
      // Delete a note
      const deleteNote = async (id) => {
        try {
          const response = await fetch(`${host}/api/notes/deletenote/${id}`, {
            method: "DELETE",
            headers: {
              'Content-Type': 'application/json',
              'auth-token': localStorage.getItem('token')
            }
          });
          if (response.ok) {
            setNotes((prevNotes) => prevNotes.filter((note) => note._id !== id));
          } else {
            console.error("Failed to delete note:", response.status);
          }
        } catch (error) {
          console.error("Error deleting note:", error);
        }
      };

      // Delete a commit
      const deleteCommit = async (id) =>{
        // Todo api call, to request the delete 
        try {
        const response = await fetch(`${host1}/api/commits/deletecommit/${id}` , {
         method: "delete",
         headers: {
           'Content-Type':'application/json',
           'auth-token': import.meta.env.VITE_COMMITS_AUTH_TOKEN
         }
       });
      
        const newCommits = commits.filter((commit)=> {return commit._id!==id})
        setCommits(newCommits);

        if (response.ok) {
         // Fetch the updated list of notes after deleting
         await getCommits();
       } else {
         console.error("Failed to delete commit:", response.status);
       }
     } catch (error) {
       console.error("Error deleting commit:", error);
     }
     }
     
      return(
        <NoteContext.Provider value={{notes, setNotes, addNote, deleteNote, editNote, getNotes, updateNoteCompletedStatus, filteredNotes, setFilteredNotes, commits, getCommits, addCommit, deleteCommit}}>
                {props.children}
            </NoteContext.Provider>  
        )
    }

export default NoteState;
