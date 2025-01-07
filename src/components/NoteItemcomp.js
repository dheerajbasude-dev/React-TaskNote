import React, { useState, useEffect,useContext,useCallback,useRef } from 'react';
import './Note.css';
import noteContext from '../context/notes/noteContext';
import { useNavigate } from 'react-router-dom';
import { DotPulse } from '@uiball/loaders';
import TaskCompletedSound from './Sounds/TaskCompleted.mp3';
import UnCompletedTaskSound from './Sounds/UnCompletedTask.mp3';
import TaskDeleted1Sound from './Sounds/TaskDeleted1.mp3';
import TaskDeleted2Sound from './Sounds/TaskDeleted2.mp3';
import AddTaskSound from './Sounds/AddTask.mp3'
import Skeleton from 'react-loading-skeleton'
import './Skeleton.css';
import ArrowCircleUpSharpIcon from '@mui/icons-material/ArrowCircleUpSharp';




const Notescomp = ({ searchQuery, selectedPriority }) => {

  // Sounds effects
  const AddSound = new Audio(AddTaskSound);
  const completeSound = new Audio(TaskCompletedSound);
  const unCompleteSound = new Audio(UnCompletedTaskSound);
  const DeletedSound1 = new Audio(TaskDeleted1Sound);
  const DeletedSound2 = new Audio(TaskDeleted2Sound);

  // Scroll to top adding
  const [showScrollButton, setShowScrollButton] = useState(false);
    
  // Ref for the task-note container
    const taskNoteContainerRef = useRef(null);
  
    useEffect(() => {
      const taskNoteContainer = taskNoteContainerRef.current;
      const handleScroll = () => {
        if (taskNoteContainer.scrollTop > 300) {
          setShowScrollButton(true);
        } else {
          setShowScrollButton(false);
        }
      };
  
      taskNoteContainer.addEventListener('scroll', handleScroll);
      return () => {
        taskNoteContainer.removeEventListener('scroll', handleScroll);
      };
    }, []);
  
    const scrollToTop = () => {
      taskNoteContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    };


  // Modal, editing and loading states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modal, Cancelling and removing the entered text
  const handleCancelTask = useCallback(() => {
    document.body.style.overflowY = "hidden";
    closeModal();
    resetTaskSwipe();
    setNote({
      title: "",
      description: "",
      tag: "medium",
    });
  }, []);

  const closeModal = () => {
    setShowModal(false)
    setIsEditing(false);
  };

  // Modal, Opening and making the scroll bar at top
  const openModal = () => {
    setShowModal(true);
    setIsEditing(false);
    setEditingNote(null);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    })
  };

  // Making the animation effect after closing the modal or open
  const resetTaskSwipe = () => {
    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => {
      task.classList.remove('swipe-right');
      
    });
  };

  // If escape keyboard is clicked the modal will closes
  useEffect(() => {
    const handleKeyDown = (evt) => {

      if (evt.key === 'Escape' && showModal) {
        handleCancelTask();
      }
  
      if (evt.key === '+' && !showModal) {
        document.querySelector('.overlay > p').innerText = 'Add task';
        document.querySelector('.btn-add-task').innerText = 'Add';

        openModal();

        setTimeout(() => {
          document.querySelector('#task-title').focus();
        }, 500);
      }
    };

    // Adding the modal top text to show the buttons name and heading
    const iptToggleModal = document.querySelector('#ipt-toggle-modal');
    iptToggleModal.addEventListener('click', function () {
      if (this.checked) {
        document.querySelector('.overlay > p').innerText = 'Add task';
        document.querySelector('.btn-add-task').innerText = 'Add note';


        document.querySelectorAll('.task').forEach((task, index) => {
          task.classList.add('swipe-right');
          task.style.transitionDelay = (index * 0.01) + 's';
        });
        document.querySelector('#task-title').focus();
      } else {
        closeModal();
        resetTaskSwipe();
      }
    });

    document.addEventListener('keydown', handleKeyDown);
  

    return () => {
      
      document.removeEventListener('keydown', handleKeyDown);
      iptToggleModal.removeEventListener('change', () => { });
    };
    // eslint-disable-next-line

  }, [showModal,handleCancelTask]);

  
  // Conext api from the express api we have created
  const context = useContext(noteContext);
  const {notes, getNotes, addNote, editNote, deleteNote,updateNoteCompletedStatus, filteredNotes, setFilteredNotes } = (context)
  let navigate = useNavigate();

  useEffect(() => {
    const fetchNotes = async () => {
        if (localStorage.getItem('token')) {
          setIsLoading(true); 
          await getNotes();
          setIsLoading(false); 
        } else {
          navigate("/auth");
        }
        setIsLoading(false);   
    };

    fetchNotes();
    // eslint-disable-next-line
  }, [navigate]);

 
  // Note and editing state for adding and editing the note using our api call
  const [note, setNote] = useState({title:"",description:"",tag:"medium"})
  const [editingNote, setEditingNote] = useState(null);

  // Showing the button loading state for adding note and editing note buttons
  const[isbtnLoading,setIsbtnLoading] = useState(false);

  // For adding the note as frontend and post requesting to the api
    const handleAddTask = async (e) => {
      e.preventDefault();
      setIsbtnLoading(true);
      if (isEditing && editingNote) {
        editNote(editingNote._id, note.title, note.description, note.tag)
        .then(() => {
          setNote({
            title: "",
            description: "",
            tag: "medium",
          });
          setIsEditing(false);
          setIsbtnLoading(false);
          handleCancelTask(); // Close the modal after the operation is complete
          document.querySelector('.notification').classList.add('-is-shown');
          setTimeout(() => {
          document.querySelector('.notification').classList.remove('-is-shown');
          }, 1000);
          setIsEditing(false);
        })
        
      } else {
        setIsbtnLoading(true);
        addNote(note.title, note.description, note.tag)
        .then(() => {
          setNote({
            title: "",
            description: "",
            tag: "medium",
          });
          AddSound.play();
          setIsbtnLoading(false);
          handleCancelTask(); // Close the modal after the operation is complete
        })
      
    }
  
   
  }


  // This will includes the valud of the name that it is set by the onChange 
  const onChange = (e) => {
    setNote({...note, [e.target.name]:e.target.value})
  }

  // Getting the tag from specified in the radio buttons as from api request
    const getFlameColor = (tag) => {
      if (tag === 'low') {
        return 'grey';
      }if (tag === 'medium') {
        return 'blue';
      }if (tag === 'high') {
        return 'red';
      }
      return 'blue'; 
    }

    function taskCompleted(event) {
      const btn = event.target; // Get the clicked button element
      const task = btn.closest('.task'); // Find the parent task element
    if (task) {
      task.classList.toggle('-is-completed'); // Toggle the class on the task element
    }
  }
  
 // Toggle the completion status of a note
  const toggleNoteCompletion = async (note) => {
    
  const completed = !note.completed;
  note.completed = completed;
  if (!completed) {
    unCompleteSound.play();
  } else {
    completeSound.play();
  }

 // Update the completion status on the server
  await updateNoteCompletedStatus(note._id, completed);

};


// Update note and calling the api request
const updateNote = (currentnNote) =>{
  setIsEditing(true);
  setShowModal(true); 
  setEditingNote(currentnNote);
  setNote({
    title: currentnNote.title,
    description: currentnNote.description,
    tag: currentnNote.tag,
  });
  document.querySelector('.overlay > p').innerText = 'Edit task';
  document.querySelector('.btn-add-task').innerText = 'Save note';
  document.querySelector('#task-title').focus();
  document.querySelectorAll('.task').forEach((task, index) => {
    task.classList.add('swipe-right');
    task.style.transitionDelay = index * 0.01 + 's';
  });
}

// Function to play a random delete sound
function playRandomDeleteSound() {
  const randomIndex = Math.floor(Math.random() * 2); // Generates 0 or 1
  if (randomIndex === 0) {
    DeletedSound1.play();
  } else {
    DeletedSound2.play();
  }
}


// Delete task
const btnRemoveTask = document.createElement('div');
btnRemoveTask.classList.add('btn-remove-task');
btnRemoveTask.title = 'Remove task';
btnRemoveTask.addEventListener('click', taskDeleted);
const removeIcon = document.createElement('ion-icon');
removeIcon.name = 'trash';
btnRemoveTask.appendChild(removeIcon);

function taskDeleted(event,note) {
  
  const btn = event.target; // Get the clicked button element
  const task = btn.closest('.task'); // Find the parent task element
  let taskStatus = task.querySelector('.task-status');
  


   const confirmBox = window.confirm(
    "Do you really want to delete this note!"
  )

  if (confirmBox === true) {
    taskStatus.innerText = 'Task removed';
    task.classList.add('-is-removed');

    setTimeout(() => {
      task.classList.add('swipe-right');
    }, 500);

    if (task.parentElement) {
    playRandomDeleteSound();
    deleteNote(note._id);
    }
    }
}



 // Filter the notes based on the search query and set filteredNotes
useEffect(() => {
  const filteredNote = notes.filter((note) => {
    const queryWords = searchQuery.toLowerCase().split(' ');

    // Check if any of the query words match in either the title or description
    return queryWords.every((queryWord) => {
      return (
        note.title.toLowerCase().includes(queryWord) ||
        note.description.toLowerCase().includes(queryWord)
      );
    }) &&
      (selectedPriority === 'All' || note.tag.toLowerCase() === selectedPriority.toLowerCase());
  });

  setFilteredNotes(filteredNote);
}, [notes, searchQuery, selectedPriority, setFilteredNotes]);


  function highlightMatches(text, searchQuery) {
    // Escape special characters in the search query and create a regular expression with 'gi' flags
  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  // Split the text into parts based on the matches
  const parts = text.split(regex);

  return parts.map((part, index) => {

    if (regex.test(part)) {
        return <span key={index} style={{background:"#F9B7FF"}}>{part}</span>; 
    }
    return part;
  });
}

// Showing the skeleton loading while in the api call
const [skeletonCount, setSkeletonCount] = useState(3); // Set an initial count

useEffect(() => {
  if (isLoading) {
    // If data is loading, set the skeleton count to match your desired fixed length
    setSkeletonCount(5);
  } else {
    // If data is loaded, set the skeleton count to match the length of filteredNotes
    setSkeletonCount(filteredNotes.length);
  }
}, [isLoading, filteredNotes]);

  return (
    <>
    <div>
      <section className="app" ref={taskNoteContainerRef} style={{ overflowY: isLoading ? "hidden" : "scroll"}}>
        <input id="ipt-toggle-modal" type="checkbox" checked={showModal} onChange={openModal}/>
        <label className="btn-toggle-modal" htmlFor="ipt-toggle-modal"> <span>+</span></label>
        <div className="notification"><i className="fa-solid fa-circle-check"></i> Task edited successfully</div>
        <div className="tasks">
           {isLoading ? (
                Array.from({ length: skeletonCount }, (_, index) => (
        <div className="task" key={`skeleton-${index}`}>
        <div className="task-header" >
          <div className="left-side">
           <Skeleton height={15} borderRadius={15} width={15}/>
          <span className="task-title"><Skeleton className="task-title-skeleton" /></span>
          </div>
          <div className="right-side">
            <div className="btn-edit-task" title="Edit task">
              <Skeleton height={18} width={18}/>
            </div>
            <div className="btn-complete-task" title="Complete task">
              <Skeleton height={18} width={18}/>
            </div>
            <div className="btn-remove-task" title="Remove task">
              <Skeleton height={18} width={18}/>
            </div>
          </div>
        </div>
        <div className="task-body"><span className="task-description"><Skeleton count={2} /></span></div>
        <div className="task-footer"><span className="task-status">Task completed</span><span className="task-timestamp-skeleton"><Skeleton width={165} height={30} /></span></div> 
        <code style={{fontWeight:"bold",position:"relative", fontSize:"12px",left:"4px",textAlignLast:"left",bottom:"12px",userSelect:"none",color:"#bb00ff"}}><Skeleton height={10} width={10} /></code>
      </div>
      ))
              ) : filteredNotes.length === 0 ? (
                searchQuery ?  <h3>No search found!</h3> : <h3>Notes not found!</h3>
              ) : null}

        {filteredNotes.map((note,index)=>{
          return <div className={`task ${note.completed ? '-is-completed' : ''}`} data-index={index} key={note._id}>
            <div className="task-header" >
              <div className="left-side">
                <ion-icon name="flame" id="flame-color" style={{ color: getFlameColor(note.tag) }}></ion-icon>
                <span className="task-title">{searchQuery ? highlightMatches(note.title, searchQuery) : note.title}</span>
              </div>
              <div className="right-side">
                <div className="btn-edit-task" title="Edit task" onClick={()=> updateNote(note)}>
                  <ion-icon name="create"></ion-icon>
                </div>
                <div className="btn-complete-task" title="Complete task"  onClick={(e) => { taskCompleted(e); toggleNoteCompletion(note); }} >
                  <ion-icon name="checkmark"></ion-icon>
                </div>
                <div className="btn-remove-task" title="Remove task" onClick={(e)=> taskDeleted(e,note)}>
                  <ion-icon name="trash"></ion-icon>
                </div>
              </div>
            </div>
            <div className="task-body"><span className="task-description">{searchQuery ? highlightMatches(note.description, searchQuery): note.description}</span></div>
            <div className="task-footer"><span className="task-status">Task completed</span><span className="task-timestamp">{note.date}</span></div>
            <code style={{fontWeight:"bold",position:"relative", fontSize:"12px",left:"4px",textAlignLast:"left",bottom:"12px",userSelect:"none",color:"#bb00ff"}}>{index+1}</code>
          </div>
        })}
        </div>
          
        <div className="overlay">
          <p>Add task</p>
          <form className="modal">
           
         
          
            <label htmlFor="task-title">Title</label>
            <input id="task-title" name="title" value={note.title} type="text" onChange={onChange} minLength={3} required/>
            <label htmlFor="task-desc">Description</label>
            <textarea id="task-desc"  name="description" value={note.description} rows="12" onChange={onChange} minLength={5} required></textarea><span>Priority</span>
           
  
            <div className="priority">
              <input id="high" type="radio" name="priority" value="high"  checked={note.tag === "high"} onChange={() => {setNote({ ...note, tag: "high" }); }}/>
              <label htmlFor="high">High</label>
              <input id="medium" type="radio" name="priority" value="medium" checked={note.tag === "medium"} onChange={() => {setNote({ ...note, tag: "medium" }); }}/>
              <label htmlFor="medium">Medium</label>
              <input id="low" type="radio" name="priority" value="low" checked={note.tag === "low"} onChange={() => {setNote({ ...note, tag: "low" });}} />
              <label htmlFor="low">Low</label>
            </div>
            <div className="modal-btns">
              
            {isbtnLoading? ( 
                  <div className="loader-btn-add-task">
                  <button disabled={true} style={{ background: "#dfe1e9" }}>
                  <DotPulse size={40} color="#bb00ff" />
                  </button>
                  </div>
            ) : (
              <button disabled={note.title.length<3 || note.description.length<5} className="btn-add-task" onClick={handleAddTask}>Add note</button>
            )}
              
              {isbtnLoading? ( 
              <div className="btn-cancel-task"></div>
              ) : (
              <div className="btn-cancel-task" onClick={handleCancelTask} >Cancel</div>
              )}
           
            </div>



          </form>
        </div>
        
      </section>
      { showScrollButton && (
              <button className="scrollToTopButton" onClick={scrollToTop}><ArrowCircleUpSharpIcon/></button>
      )}
    </div>


    </>
  )
}

export default Notescomp;
