import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import './Note.css';
import noteContext from '../context/notes/noteContext';
import { useNavigate } from 'react-router-dom';
import { DotPulse } from '@uiball/loaders';
import TaskCompletedSound from './Sounds/TaskCompleted.mp3';
import UnCompletedTaskSound from './Sounds/UnCompletedTask.mp3';
import TaskDeleted1Sound from './Sounds/TaskDeleted1.mp3';
import TaskDeleted2Sound from './Sounds/TaskDeleted2.mp3';
import AddTaskSound from './Sounds/AddTask.mp3';
import EditTaskSound from './Sounds/Edited.mp3';
import Skeleton from 'react-loading-skeleton';
import './Skeleton.css';
import ArrowCircleUpSharpIcon from '@mui/icons-material/ArrowCircleUpSharp';

const Notescomp = ({ searchQuery, setSearchQuery, selectedPriority }) => {
  // Sounds effects
  const AddSound = useRef(new Audio(AddTaskSound)).current;
  const completeSound = useRef(new Audio(TaskCompletedSound)).current;
  const unCompleteSound = useRef(new Audio(UnCompletedTaskSound)).current;
  const DeletedSound1 = useRef(new Audio(TaskDeleted1Sound)).current;
  const DeletedSound2 = useRef(new Audio(TaskDeleted2Sound)).current;
  const editSound = useRef(new Audio(EditTaskSound)).current;

  // Scroll to top
  const [showScrollButton, setShowScrollButton] = useState(false);
  const taskNoteContainerRef = useRef(null);

  // Context API
  const context = useContext(noteContext);
  const { notes, setNotes, getNotes, addNote, editNote, deleteNote, updateNoteCompletedStatus, filteredNotes, setFilteredNotes } = context;
  const navigate = useNavigate();

  // Modal, editing and loading states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState({ title: '', description: '', tag: 'medium' });
  const [editingNote, setEditingNote] = useState(null);
  const [isbtnLoading, setIsbtnLoading] = useState(false);

  // Drag & Drop State
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Spotlight Focus Mode State
  const [spotlightNote, setSpotlightNote] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60); // 25 min default pomodoro
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPreset, setTimerPreset] = useState(25); // 25, 15, 5, or 0 (stopwatch)

  // Scroll handling
  useEffect(() => {
    const taskNoteContainer = taskNoteContainerRef.current;
    if (!taskNoteContainer) return;
    const handleScroll = () => {
      if (taskNoteContainer.scrollTop > 300) {
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
      }
    };
    taskNoteContainer.addEventListener('scroll', handleScroll);
    return () => taskNoteContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (taskNoteContainerRef.current) {
      taskNoteContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Fetch initial notes on mount
  useEffect(() => {
    const fetchNotes = async () => {
      if (localStorage.getItem('token')) {
        setIsLoading(true);
        await getNotes();
        setIsLoading(false);
      } else {
        navigate('/auth');
      }
    };
    fetchNotes();
    // eslint-disable-next-line
  }, [navigate]);

  // Modal helpers
  const resetTaskSwipe = () => {
    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => task.classList.remove('swipe-right'));
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
  };

  const handleCancelTask = useCallback(() => {
    document.body.style.overflowY = 'hidden';
    closeModal();
    resetTaskSwipe();
    setNote({ title: '', description: '', tag: 'medium' });
  }, []);

  const openModal = () => {
    setShowModal(true);
    setIsEditing(false);
    setEditingNote(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sound helper for delete
  const playRandomDeleteSound = () => {
    const randomIndex = Math.floor(Math.random() * 2);
    if (randomIndex === 0) {
      DeletedSound1.play();
    } else {
      DeletedSound2.play();
    }
  };

  // Filter notes based on search query, priority & custom drag order
  useEffect(() => {
    const customOrderStr = localStorage.getItem('tasknote_custom_order');
    let orderMap = {};
    if (customOrderStr) {
      try {
        const orderArr = JSON.parse(customOrderStr);
        orderArr.forEach((id, idx) => { orderMap[id] = idx; });
      } catch (e) {
        console.error('Error parsing custom order:', e);
      }
    }

    let filtered = notes.filter((item) => {
      const queryWords = searchQuery.toLowerCase().split(' ').filter(Boolean);
      const matchesQuery = queryWords.length === 0 || queryWords.every((w) =>
        item.title.toLowerCase().includes(w) || item.description.toLowerCase().includes(w)
      );
      const matchesPriority = selectedPriority === 'All' || item.tag.toLowerCase() === selectedPriority.toLowerCase();
      return matchesQuery && matchesPriority;
    });

    if (Object.keys(orderMap).length > 0) {
      filtered.sort((a, b) => {
        const orderA = orderMap[a._id] !== undefined ? orderMap[a._id] : 999999;
        const orderB = orderMap[b._id] !== undefined ? orderMap[b._id] : 999999;
        return orderA - orderB;
      });
    }

    setFilteredNotes(filtered);
  }, [notes, searchQuery, selectedPriority, setFilteredNotes]);

  // Keep spotlightNote in sync if notes update
  useEffect(() => {
    if (spotlightNote) {
      const updated = notes.find(n => n._id === spotlightNote._id);
      if (updated) {
        setSpotlightNote(updated);
      }
    }
  }, [notes, spotlightNote]);

  // Spotlight Focus Timer effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (timerPreset === 0) {
            return prev + 1; // Stopwatch count up
          }
          if (prev <= 1) {
            setIsTimerRunning(false);
            try { AddSound.play(); } catch (e) {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerPreset, AddSound]);

  const setTimerDuration = (minutes) => {
    setIsTimerRunning(false);
    setTimerPreset(minutes);
    setTimerSeconds(minutes * 60);
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Keyboard navigation for Modal & Spotlight Mode
  useEffect(() => {
    const handleKeyDown = (evt) => {
      if (evt.key === 'Escape') {
        if (spotlightNote) {
          setSpotlightNote(null);
          setIsTimerRunning(false);
          return;
        }
        if (showModal) {
          handleCancelTask();
        }
      }

      if (spotlightNote) {
        if (evt.key === 'ArrowLeft') {
          goToAdjacentSpotlight(-1);
        } else if (evt.key === 'ArrowRight') {
          goToAdjacentSpotlight(1);
        }
      }

      if (evt.key === '+' && !showModal && !spotlightNote) {
        const overlayP = document.querySelector('.overlay > p');
        const btnAdd = document.querySelector('.btn-add-task');
        if (overlayP) overlayP.innerText = 'Add task';
        if (btnAdd) btnAdd.innerText = 'Add';
        openModal();
        setTimeout(() => {
          const taskTitleInput = document.querySelector('#task-title');
          if (taskTitleInput) taskTitleInput.focus();
        }, 500);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, spotlightNote, handleCancelTask]);

  // Spotlight navigation
  const goToAdjacentSpotlight = (direction) => {
    if (!spotlightNote || filteredNotes.length === 0) return;
    const currentIndex = filteredNotes.findIndex(n => n._id === spotlightNote._id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + direction + filteredNotes.length) % filteredNotes.length;
    setSpotlightNote(filteredNotes[nextIndex]);
  };

  const openSpotlight = (noteItem) => {
    setSpotlightNote(noteItem);
    setTimerDuration(25); // default 25 min pomodoro
  };

  const closeSpotlight = () => {
    setSpotlightNote(null);
    setIsTimerRunning(false);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Visual drag image / styling
    setTimeout(() => {
      const taskEl = document.querySelector(`[data-index="${index}"]`);
      if (taskEl) taskEl.classList.add('is-dragging');
    }, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Keep clean
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updatedList = Array.from(filteredNotes);
    const [draggedItem] = updatedList.splice(draggingIndex, 1);
    updatedList.splice(targetIndex, 0, draggedItem);

    setFilteredNotes(updatedList);

    // Save custom order to localStorage
    const orderIds = updatedList.map(item => item._id);
    localStorage.setItem('tasknote_custom_order', JSON.stringify(orderIds));

    // Also update main notes order if setNotes exists
    if (typeof setNotes === 'function') {
      const notesCopy = Array.from(notes);
      notesCopy.sort((a, b) => {
        const idxA = orderIds.indexOf(a._id);
        const idxB = orderIds.indexOf(b._id);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
      setNotes(notesCopy);
    }

    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
    document.querySelectorAll('.task').forEach(el => {
      el.classList.remove('is-dragging');
      el.classList.remove('drag-over');
    });
  };

  // Add / Edit task submission
  const handleAddTask = async (e) => {
    e.preventDefault();
    setIsbtnLoading(true);
    if (isEditing && editingNote) {
      editNote(editingNote._id, note.title, note.description, note.tag)
        .then(() => {
          setNote({ title: '', description: '', tag: 'medium' });
          setIsEditing(false);
          setIsbtnLoading(false);
          handleCancelTask();
          editSound.play();
          const notificationEl = document.querySelector('.notification');
          if (notificationEl) {
            notificationEl.classList.add('-is-shown');
            setTimeout(() => notificationEl.classList.remove('-is-shown'), 1000);
          }
        });
    } else {
      addNote(note.title, note.description, note.tag)
        .then(() => {
          setNote({ title: '', description: '', tag: 'medium' });
          AddSound.play();
          setIsbtnLoading(false);
          handleCancelTask();
        });
    }
  };

  const onChange = (e) => {
    setNote({ ...note, [e.target.name]: e.target.value });
  };

  const handleDescriptionInput = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const getFlameColor = (tag) => {
    if (tag === 'low') return '#a0aec0';
    if (tag === 'medium') return '#3b82f6';
    if (tag === 'high') return '#ef4444';
    return '#3b82f6';
  };

  // Toggle completion
  const toggleNoteCompletion = async (noteItem) => {
    const completed = !noteItem.completed;
    noteItem.completed = completed;
    if (!completed) {
      unCompleteSound.play();
    } else {
      completeSound.play();
    }
    await updateNoteCompletedStatus(noteItem._id, completed);
  };

  // Edit Note Trigger
  const updateNote = (currentNote) => {
    setIsEditing(true);
    setShowModal(true);
    setEditingNote(currentNote);
    setNote({
      title: currentNote.title,
      description: currentNote.description,
      tag: currentNote.tag,
    });
    const overlayP = document.querySelector('.overlay > p');
    const btnAdd = document.querySelector('.btn-add-task');
    if (overlayP) overlayP.innerText = 'Edit task';
    if (btnAdd) btnAdd.innerText = 'Save note';
    const titleEl = document.querySelector('#task-title');
    if (titleEl) titleEl.focus();
    document.querySelectorAll('.task').forEach((t, index) => {
      t.classList.add('swipe-right');
      t.style.transitionDelay = index * 0.01 + 's';
    });
  };

  // Delete Task Trigger
  const taskDeleted = (event, noteItem) => {
    event.stopPropagation();
    const confirmBox = window.confirm('Do you really want to delete this note?');
    if (confirmBox === true) {
      const btn = event.target;
      const task = btn.closest('.task');
      if (task) {
        const taskStatus = task.querySelector('.task-status');
        if (taskStatus) taskStatus.innerText = 'Task removed';
        task.classList.add('-is-removed');
        setTimeout(() => task.classList.add('swipe-right'), 500);
      }
      playRandomDeleteSound();
      deleteNote(noteItem._id);
      if (spotlightNote && spotlightNote._id === noteItem._id) {
        closeSpotlight();
      }
    }
  };

  // Search matches highlighting
  const highlightMatches = (text, query) => {
    if (!query) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return <span key={index} style={{ background: '#F9B7FF', borderRadius: '3px', padding: '0 2px' }}>{part}</span>;
      }
      return part;
    });
  };

  // Redirect if search is /commits
  if (searchQuery === '/commits') {
    navigate('/commits');
    setSearchQuery('');
  }

  const [skeletonCount, setSkeletonCount] = useState(3);
  useEffect(() => {
    if (isLoading) {
      setSkeletonCount(5);
    } else {
      setSkeletonCount(filteredNotes.length || 3);
    }
  }, [isLoading, filteredNotes]);

  // Current spotlight index
  const currentSpotlightIndex = spotlightNote
    ? filteredNotes.findIndex(n => n._id === spotlightNote._id)
    : -1;

  return (
    <>
      <div>
        <section className="app" ref={taskNoteContainerRef}>
          <input id="ipt-toggle-modal" type="checkbox" checked={showModal} onChange={openModal} />
          <label className="btn-toggle-modal" htmlFor="ipt-toggle-modal" title="Add new task">
            <span>+</span>
          </label>
          <div className="notification">
            <i className="fa-solid fa-circle-check"></i> Task edited successfully
          </div>

          <div className="tasks">
            {isLoading ? (
              Array.from({ length: skeletonCount }, (_, index) => (
                <div className="task" key={`skeleton-${index}`}>
                  <div className="task-header">
                    <div className="left-side">
                      <Skeleton height={15} borderRadius={15} width={15} />
                      <span className="task-title"><Skeleton className="task-title-skeleton" /></span>
                    </div>
                    <div className="right-side">
                      <div className="btn-edit-task"><Skeleton height={18} width={18} /></div>
                      <div className="btn-complete-task"><Skeleton height={18} width={18} /></div>
                      <div className="btn-remove-task"><Skeleton height={18} width={18} /></div>
                    </div>
                  </div>
                  <div className="task-body"><span className="task-description"><Skeleton count={2} /></span></div>
                  <div className="task-footer">
                    <span className="task-status">Task completed</span>
                    <span className="task-timestamp-skeleton"><Skeleton width={165} height={30} /></span>
                  </div>
                </div>
              ))
            ) : filteredNotes.length === 0 ? (
              searchQuery ? <h3 className="empty-state-text">No search found!</h3> : <h3 className="empty-state-text">Notes not found!</h3>
            ) : null}

            {filteredNotes.map((noteItem, index) => {
              const isItemDragging = draggingIndex === index;
              const isItemOver = dragOverIndex === index;
              const isFirstTask = index === filteredNotes.length - 1;
              return (
                <div
                  className={`task ${noteItem.completed ? '-is-completed' : ''} ${isFirstTask ? 'is-spotlight-first' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
                  data-index={index}
                  key={noteItem._id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="task-header">
                    <div className="left-side">
                      <ion-icon
                        name="flame"
                        id="flame-color"
                        style={{ color: getFlameColor(noteItem.tag) }}
                      ></ion-icon>
                      <span className="task-title">
                        {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                      </span>
                    </div>
                    <div className="right-side">
                      <div
                        className="btn-edit-task"
                        title="Edit task"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateNote(noteItem);
                        }}
                      >
                        <ion-icon name="create"></ion-icon>
                      </div>
                      <div
                        className="btn-complete-task"
                        title="Toggle completed"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNoteCompletion(noteItem);
                        }}
                      >
                        <ion-icon name="checkmark"></ion-icon>
                      </div>
                      <div
                        className="btn-remove-task"
                        title="Remove task"
                        onClick={(e) => taskDeleted(e, noteItem)}
                      >
                        <ion-icon name="trash"></ion-icon>
                      </div>
                    </div>
                  </div>

                  <div className="task-body">
                    <span className="task-description">
                      {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                    </span>
                  </div>

                  <div className="task-footer">
                    <span className="task-status">Task completed</span>
                    <div className="task-timestamps">
                      <span className="task-timestamp" title="Added date">
                        {noteItem.date}
                      </span>
                      {noteItem.updatedDate && noteItem.updatedDate !== noteItem.date && (
                        <span className="task-timestamp task-timestamp-updated" title="Last updated date">
                          Updated: {noteItem.updatedDate}
                        </span>
                      )}
                    </div>
                  </div>

                  <code className="task-index-badge">
                    {index + 1}
                  </code>
                </div>
              );
            })}
          </div>

          {/* Add / Edit Task Modal */}
          <div className="overlay" style={{ overflowY: showModal ? 'auto' : 'hidden' }}>
            <p>Add task</p>
            <form className="modal" onSubmit={handleAddTask}>
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                name="title"
                value={note.title}
                type="text"
                onChange={onChange}
                minLength={3}
                placeholder="What's on your mind?"
                required
              />
              <label htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                name="description"
                value={note.description}
                rows={1}
                style={{ overflow: 'hidden', resize: 'none' }}
                onChange={(e) => {
                  onChange(e);
                  handleDescriptionInput(e);
                }}
                minLength={5}
                placeholder="What's the description?"
                required
              ></textarea>
              <span>Priority</span>

              <div className="priority">
                <input
                  id="high"
                  type="radio"
                  name="priority"
                  value="high"
                  checked={note.tag === 'high'}
                  onChange={() => setNote({ ...note, tag: 'high' })}
                />
                <label htmlFor="high">High</label>
                <input
                  id="medium"
                  type="radio"
                  name="priority"
                  value="medium"
                  checked={note.tag === 'medium'}
                  onChange={() => setNote({ ...note, tag: 'medium' })}
                />
                <label htmlFor="medium">Medium</label>
                <input
                  id="low"
                  type="radio"
                  name="priority"
                  value="low"
                  checked={note.tag === 'low'}
                  onChange={() => setNote({ ...note, tag: 'low' })}
                />
                <label htmlFor="low">Low</label>
              </div>

              <div className="modal-btns">
                {isbtnLoading ? (
                  <div className="loader-btn-add-task">
                    <button disabled={true} style={{ background: '#dfe1e9' }}>
                      <DotPulse size={40} color="#bb00ff" />
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={note.title.length < 3 || note.description.length < 5}
                    className="btn-add-task"
                    type="submit"
                  >
                    Add note
                  </button>
                )}

                {isbtnLoading ? (
                  <div className="btn-cancel-task"></div>
                ) : (
                  <div className="btn-cancel-task" onClick={handleCancelTask}>
                    Cancel
                  </div>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* Scroll to Top Button */}
        {showScrollButton && (
          <button className="scrollToTopButton" onClick={scrollToTop} title="Scroll to Top">
            <ArrowCircleUpSharpIcon />
          </button>
        )}

        {/* ========================================================= */}
        {/* SPOTLIGHT FOCUS MODE (Ultra-Premium Single-Task Focus)     */}
        {/* ========================================================= */}
        {spotlightNote && (
          <div className="spotlight-overlay" onClick={closeSpotlight}>
            <div className="spotlight-container" onClick={(e) => e.stopPropagation()}>
              {/* Spotlight Glow Header */}
              <div className="spotlight-header">
                <div className="spotlight-badge-container">
                  <span
                    className="spotlight-priority-badge"
                    style={{
                      borderColor: getFlameColor(spotlightNote.tag),
                      color: getFlameColor(spotlightNote.tag),
                      boxShadow: `0 0 12px ${getFlameColor(spotlightNote.tag)}33`,
                    }}
                  >
                    <ion-icon name="flame" style={{ color: getFlameColor(spotlightNote.tag) }}></ion-icon>
                    {spotlightNote.tag.toUpperCase()} PRIORITY
                  </span>
                  <span className="spotlight-counter">
                    Task {currentSpotlightIndex + 1} of {filteredNotes.length}
                  </span>
                </div>
                <button className="spotlight-close-btn" onClick={closeSpotlight} title="Close (Esc)">
                  <ion-icon name="close-outline"></ion-icon>
                </button>
              </div>

              {/* Spotlight Card Body */}
              <div className="spotlight-body">
                <div className="spotlight-title-row">
                  <h1 className={`spotlight-title ${spotlightNote.completed ? 'is-completed' : ''}`}>
                    {spotlightNote.title}
                  </h1>
                </div>

                <div className="spotlight-desc-box">
                  <p className="spotlight-description">{spotlightNote.description}</p>
                </div>

                <div className="spotlight-meta-row">
                  <div className="spotlight-timestamps-group">
                    <span className="spotlight-timestamp" title="Added date">
                      <ion-icon name="calendar-outline"></ion-icon> Added: {spotlightNote.date}
                    </span>
                    {spotlightNote.updatedDate && spotlightNote.updatedDate !== spotlightNote.date && (
                      <span className="spotlight-timestamp spotlight-timestamp-updated" title="Last updated date">
                        <ion-icon name="create-outline"></ion-icon> Updated: {spotlightNote.updatedDate}
                      </span>
                    )}
                  </div>
                  <span className={`spotlight-status-pill ${spotlightNote.completed ? 'completed' : 'pending'}`}>
                    {spotlightNote.completed ? '✓ Completed' : '⚡ In Progress'}
                  </span>
                </div>

                {/* Built-in Productivity Focus Timer */}
                <div className="spotlight-timer-card">
                  <div className="spotlight-timer-header">
                    <div className="spotlight-timer-title">
                      <ion-icon name="timer-outline"></ion-icon> Focus Timer
                    </div>
                    <div className="spotlight-timer-presets">
                      <button
                        className={`timer-preset-btn ${timerPreset === 25 ? 'active' : ''}`}
                        onClick={() => setTimerDuration(25)}
                      >
                        25m
                      </button>
                      <button
                        className={`timer-preset-btn ${timerPreset === 15 ? 'active' : ''}`}
                        onClick={() => setTimerDuration(15)}
                      >
                        15m
                      </button>
                      <button
                        className={`timer-preset-btn ${timerPreset === 5 ? 'active' : ''}`}
                        onClick={() => setTimerDuration(5)}
                      >
                        5m
                      </button>
                      <button
                        className={`timer-preset-btn ${timerPreset === 0 ? 'active' : ''}`}
                        onClick={() => setTimerDuration(0)}
                      >
                        Stopwatch
                      </button>
                    </div>
                  </div>

                  <div className="spotlight-timer-display-row">
                    <div className={`spotlight-timer-digits ${isTimerRunning ? 'pulsing' : ''}`}>
                      {formatTimer(timerSeconds)}
                    </div>
                    <div className="spotlight-timer-controls">
                      <button
                        className={`timer-action-btn ${isTimerRunning ? 'pause' : 'start'}`}
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                      >
                        <ion-icon name={isTimerRunning ? 'pause' : 'play'}></ion-icon>
                        {isTimerRunning ? 'Pause' : 'Focus Now'}
                      </button>
                      <button
                        className="timer-reset-btn"
                        onClick={() => setTimerDuration(timerPreset)}
                        title="Reset Timer"
                      >
                        <ion-icon name="refresh-outline"></ion-icon>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Spotlight Actions Bar */}
                <div className="spotlight-actions">
                  <button
                    className={`spotlight-btn toggle-complete ${spotlightNote.completed ? 'completed' : ''}`}
                    onClick={() => toggleNoteCompletion(spotlightNote)}
                  >
                    <ion-icon name={spotlightNote.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}></ion-icon>
                    {spotlightNote.completed ? 'Completed' : 'Mark as Done'}
                  </button>

                  <button
                    className="spotlight-btn edit"
                    onClick={() => {
                      closeSpotlight();
                      updateNote(spotlightNote);
                    }}
                  >
                    <ion-icon name="create-outline"></ion-icon>
                    Edit Task
                  </button>

                  <button
                    className="spotlight-btn delete"
                    onClick={(e) => taskDeleted(e, spotlightNote)}
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                    Delete
                  </button>
                </div>
              </div>

              {/* Spotlight Navigation Footer */}
              <div className="spotlight-footer">
                <button
                  className="spotlight-nav-btn prev"
                  onClick={() => goToAdjacentSpotlight(-1)}
                  disabled={filteredNotes.length <= 1}
                  title="Previous Task (←)"
                >
                  <ion-icon name="arrow-back-outline"></ion-icon>
                  <span>Previous</span>
                </button>

                <div className="spotlight-keyboard-hints">
                  <span><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
                  <span><kbd>Esc</kbd> Exit</span>
                </div>

                <button
                  className="spotlight-nav-btn next"
                  onClick={() => goToAdjacentSpotlight(1)}
                  disabled={filteredNotes.length <= 1}
                  title="Next Task (→)"
                >
                  <span>Next</span>
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Notescomp;
