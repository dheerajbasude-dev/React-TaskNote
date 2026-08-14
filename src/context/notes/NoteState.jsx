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

    // Date formatting helper
    const formatTaskDate = (d = new Date()) => {
      try {
        const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return typeof d === 'string' ? d : '';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = days[dateObj.getDay()];
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        let hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const formattedHours = String(hours).padStart(2, '0');
        return `${dayName} ${day}-${month}-${year} ${formattedHours}:${minutes}${ampm}`;
      } catch (e) {
        return '';
      }
    };

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
          let updateMap = {};
          try {
            const stored = localStorage.getItem('tasknote_updated_map');
            if (stored) updateMap = JSON.parse(stored);
          } catch (e) {}

          const processed = json.map((n) => {
            if (updateMap[n._id]) {
              return { ...n, updatedDate: updateMap[n._id] };
            }
            if (n.updatedAt && n.updatedAt !== n.date) {
              return { ...n, updatedDate: formatTaskDate(n.updatedAt) };
            }
            if (n.updatedDate) {
              return { ...n, updatedDate: n.updatedDate };
            }
            return n;
          });
          setNotes(processed);
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
      const addNote = async (title, description, tag) =>{
        // Todo api call, Adding post request for storing the title description and tag
        try {
        const response = await fetch(`${host}/api/notes/addnote` , {
          method: "POST",
          headers: {
            'Content-Type':'application/json',
            'auth-token':localStorage.getItem('token')
          },
          body:JSON.stringify({title, description, tag})
        });

        if (response.ok) {
          // Fetch the updated list of notes after adding a new one
          await getNotes();

          const note = await response.json()
          setNotes(notes.concat(note))

        } else {
          console.error("Failed to add note:", response.status);
        }
      } catch(error) {
        console.error("Error adding note:", error);
      }
      /*This is being used by practice*/ 
      // console.log("Adding a new note")
      // const note = {
      //   "_id": "64d4d82411f3e6e3c7c4e154",
      //   "user": "64d498048c18c635f95714ee",
      //   "title": title,
      //   "description": description,
      //   "tag": tag,
      //   "date": "2023-08-10T12:29:24.784Z",
      //   "__v": 0
      // };

      // setNotes(notes.concat(note))
      }


      //Add a commit
       const addCommit = async (label, author) =>{
        // Todo api call, Adding post request for storing the title description and tag
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
          // Fetch the updated list of notes after adding a new one
          await getCommits();

          const commit = await response.json()
          setCommits(commits.concat(commit))

        } else {
          console.error("Failed to add commit:", response.status);
        }
      } catch(error) {
        console.error("Error adding commit:", error);
      }}


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
      // Handle the successful completion of the request
    } else {
      console.error("Failed to update note completion status:", response.status);
    }
  } catch (error) {
    console.error("Error updating note completion status:", error);
  }
};

  
      
      // Edit a note
      const editNote = async (id, title, description, tag) =>{
        // api call, to edit put request in the api
        try {
        const response = await fetch(`${host}/api/notes/updatenote/${id}` , {
          method: "put",
          headers: {
            'Content-Type':'application/json',
            'auth-token':localStorage.getItem('token')
          },
          body:JSON.stringify({title, description, tag})
        });
        /*This is being used by practice*/ 
        // const json =  await response.json();
        // console.log(json)

        if (response.ok) {
          const updatedTimeStr = formatTaskDate(new Date());
          let updateMap = {};
          try {
            const stored = localStorage.getItem('tasknote_updated_map');
            if (stored) updateMap = JSON.parse(stored);
          } catch (e) {}
          updateMap[id] = updatedTimeStr;
          localStorage.setItem('tasknote_updated_map', JSON.stringify(updateMap));

          // Fetch the updated list of notes after editing
          await getNotes();
          
          let newNotes = JSON.parse(JSON.stringify(notes));
          // Logic to edit the note in client
          for (let index = 0; index < newNotes.length; index++) {
            const element = newNotes[index];   
            if (element._id === id){
              newNotes[index].title = title;
              newNotes[index].description = description;
              newNotes[index].tag = tag;
              newNotes[index].updatedDate = updatedTimeStr;
              break;
            } 
          }
          setNotes(newNotes);

        } else {
          console.error("Failed to edit note:", response.status);
        }
      } catch (error) {
        console.error("Error editing note:", error)
      }


      }
      
      // Delete a note
      const deleteNote = async (id) =>{
         // Todo api call, to request the delete 
         try {
         const response = await fetch(`${host}/api/notes/deletenote/${id}` , {
          method: "delete",
          headers: {
            'Content-Type':'application/json',
            'auth-token':localStorage.getItem('token')
          }
        });
        /*This is being used by practice*/ 
        // const json =  response.json();
        // console.log(json)

         /*This is being used by practice*/ 
        //  console.log("Deleting the note" + id)
         const newNotes = notes.filter((note)=> {return note._id!==id})
         setNotes(newNotes);

         if (response.ok) {
          // Fetch the updated list of notes after deleting
          await getNotes();
        } else {
          console.error("Failed to delete note:", response.status);
        }
      } catch (error) {
        console.error("Error deleting note:", error);
      }
      }

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
