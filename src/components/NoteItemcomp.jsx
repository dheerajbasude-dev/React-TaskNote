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
import Skeleton from 'react-loading-skeleton';
import './Skeleton.css';
import ArrowCircleUpSharpIcon from '@mui/icons-material/ArrowCircleUpSharp';

// ============================================================================
// COMPACT SUBTASK PARSER & SERIALIZER
// ============================================================================

export const parseDescription = (desc) => {
  if (!desc || typeof desc !== 'string') {
    return { isStructured: false, items: [], totalCount: 0, completedCount: 0, percentage: 0 };
  }

  const trimmed = desc.trim();
  if (!trimmed) {
    return { isStructured: false, items: [], totalCount: 0, completedCount: 0, percentage: 0 };
  }

  const parts = trimmed.includes('\n')
    ? trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

  const structuredItems = [];
  let foundColon = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Markdown checkbox: "- [x] task"
    const mdMatch = part.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
    if (mdMatch) {
      const isDone = mdMatch[1].toLowerCase() === 'x';
      structuredItems.push({
        id: `sub-${i}`,
        topic: mdMatch[2].trim(),
        status: isDone ? 'completed' : 'pending',
      });
      foundColon = true;
      continue;
    }

    // "Topic: status"
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0 && colonIdx < part.length - 1) {
      const topic = part.slice(0, colonIdx).trim();
      const status = part.slice(colonIdx + 1).trim();
      if (topic && status) {
        structuredItems.push({
          id: `sub-${i}`,
          topic,
          status,
        });
        foundColon = true;
      }
    }
  }

  if (foundColon && structuredItems.length > 0) {
    const totalCount = structuredItems.length;
    const completedCount = structuredItems.filter((item) => {
      const s = item.status.toLowerCase();
      return s.includes('completed') || s.includes('done') || s === 'finished';
    }).length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    return {
      isStructured: true,
      items: structuredItems,
      totalCount,
      completedCount,
      percentage,
    };
  }

  return { isStructured: false, items: [], totalCount: 0, completedCount: 0, percentage: 0 };
};

export const getSubtaskStatusType = (statusStr) => {
  if (!statusStr) return 'pending';
  const s = statusStr.toLowerCase();
  if (s.includes('completed') || s.includes('done') || s === 'finished') return 'completed';
  if (s.includes('progress') || s.includes('doing') || s.includes('--') || s.includes('[')) return 'in-progress';
  return 'pending';
};

export const toggleSubtaskItemStatus = (currentDesc, targetIndex) => {
  const parsed = parseDescription(currentDesc);
  if (!parsed.isStructured || !parsed.items[targetIndex]) return currentDesc;

  const item = parsed.items[targetIndex];
  const currentStatusType = getSubtaskStatusType(item.status);

  let newStatus = '';
  if (currentStatusType === 'pending') {
    newStatus = 'in-progress';
  } else if (currentStatusType === 'in-progress') {
    if (item.status.includes('--')) {
      newStatus = item.status.replace(/pending/gi, 'completed');
    } else {
      newStatus = 'completed';
    }
  } else {
    if (item.status.includes('--')) {
      newStatus = item.status.replace(/completed/gi, 'pending');
    } else {
      newStatus = 'pending';
    }
  }

  parsed.items[targetIndex].status = newStatus;
  return parsed.items.map((it) => `${it.topic}: ${it.status}`).join(' , ');
};

// ============================================================================
// MAIN NOTE COMPONENT
// ============================================================================

const Notescomp = ({ searchQuery, setSearchQuery, selectedPriority }) => {
  const playSound = useCallback((soundFile) => {
    try {
      const audio = new Audio(soundFile);
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }, []);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const taskNoteContainerRef = useRef(null);

  const context = useContext(noteContext);
  const { notes, setNotes, getNotes, addNote, editNote, deleteNote, updateNoteCompletedStatus, filteredNotes, setFilteredNotes } = context;
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState({ title: '', description: '', tag: 'medium' });
  const [editingNote, setEditingNote] = useState(null);
  const [isbtnLoading, setIsbtnLoading] = useState(false);

  // Subtask Builder State in Modal
  const [activeModalTab, setActiveModalTab] = useState('structured'); // 'structured' | 'plaintext'
  const [builderSubtasks, setBuilderSubtasks] = useState([]);
  const [newTopic, setNewTopic] = useState('');
  const [newStatus, setNewStatus] = useState('pending');

  // Drag & Drop State
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Scroll handling
  useEffect(() => {
    const handleWindowScroll = () => {
      if (window.scrollY > 250 || (taskNoteContainerRef.current && taskNoteContainerRef.current.scrollTop > 250)) {
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
      }
    };
    window.addEventListener('scroll', handleWindowScroll);
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (taskNoteContainerRef.current) {
      taskNoteContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setBuilderSubtasks([]);
    setNewTopic('');
    setNewStatus('pending');
  };

  const handleCancelTask = useCallback(() => {
    closeModal();
    setNote({ title: '', description: '', tag: 'medium' });
  }, []);

  const openModal = () => {
    setShowModal(true);
    setIsEditing(false);
    setEditingNote(null);
    setActiveModalTab('structured');
    setBuilderSubtasks([]);
    setNewTopic('');
    setNewStatus('pending');
  };

  const playRandomDeleteSound = () => {
    playSound(Math.random() < 0.5 ? TaskDeleted1Sound : TaskDeleted2Sound);
  };

  // Subtask Builder synchronization
  const syncBuilderToDescription = (subtasksList) => {
    if (subtasksList.length === 0) {
      setNote((prev) => ({ ...prev, description: '' }));
      return;
    }
    const formatted = subtasksList.map((item) => `${item.topic}: ${item.status}`).join(' , ');
    setNote((prev) => ({ ...prev, description: formatted }));
  };

  const handleAddSubtaskToBuilder = (e) => {
    if (e) e.preventDefault();
    if (!newTopic.trim()) return;

    const newItem = {
      id: `builder-${Date.now()}-${Math.random()}`,
      topic: newTopic.trim(),
      status: newStatus || 'pending',
    };

    const updated = [...builderSubtasks, newItem];
    setBuilderSubtasks(updated);
    setNewTopic('');
    syncBuilderToDescription(updated);
  };

  const handleRemoveBuilderSubtask = (index) => {
    const updated = builderSubtasks.filter((_, idx) => idx !== index);
    setBuilderSubtasks(updated);
    syncBuilderToDescription(updated);
  };

  const handleCycleBuilderStatus = (index) => {
    const updated = [...builderSubtasks];
    const currentStatus = getSubtaskStatusType(updated[index].status);
    let nextStatus = 'pending';
    if (currentStatus === 'pending') nextStatus = 'in-progress';
    else if (currentStatus === 'in-progress') nextStatus = 'completed';
    else nextStatus = 'pending';

    updated[index].status = nextStatus;
    setBuilderSubtasks(updated);
    syncBuilderToDescription(updated);
  };

  const handleApplyPresetTemplate = (presetType) => {
    let items = [];
    if (presetType === 'interview') {
      items = [
        { id: 'p-1', topic: 'Interview', status: 'pending' },
        { id: 'p-2', topic: 'Interview-prep', status: 'pending' },
        { id: 'p-3', topic: 'Java', status: 'pending' },
        { id: 'p-4', topic: 'SpringBoot', status: 'completed' },
        { id: 'p-5', topic: 'Microservice-topics', status: 'pending' },
        { id: 'p-6', topic: 'DSA', status: 'pending' },
        { id: 'p-7', topic: 'System-design', status: 'pending' },
        { id: 'p-8', topic: 'Coding', status: 'pending' },
      ];
    } else if (presetType === 'sprint') {
      items = [
        { id: 'p-1', topic: 'UI/UX Design', status: 'completed' },
        { id: 'p-2', topic: 'Backend API', status: 'in-progress' },
        { id: 'p-3', topic: 'Frontend Integration', status: 'pending' },
        { id: 'p-4', topic: 'Unit Tests', status: 'pending' },
        { id: 'p-5', topic: 'Deployment', status: 'pending' },
      ];
    } else if (presetType === 'study') {
      items = [
        { id: 'p-1', topic: 'Theory & Core Concepts', status: 'completed' },
        { id: 'p-2', topic: 'Hands-on Coding Labs', status: 'in-progress' },
        { id: 'p-3', topic: 'Practice Exercises', status: 'pending' },
        { id: 'p-4', topic: 'Final Revision', status: 'pending' },
      ];
    } else if (presetType === 'daily') {
      items = [
        { id: 'p-1', topic: 'Morning Standup', status: 'completed' },
        { id: 'p-2', topic: 'Primary Task Block', status: 'in-progress' },
        { id: 'p-3', topic: 'Code Review', status: 'pending' },
        { id: 'p-4', topic: 'Daily Wrap-up', status: 'pending' },
      ];
    }

    setBuilderSubtasks(items);
    syncBuilderToDescription(items);
    setActiveModalTab('structured');
  };

  // Filter notes
  useEffect(() => {
    const customOrderStr = localStorage.getItem('tasknote_custom_order');
    let orderMap = {};
    if (customOrderStr) {
      try {
        const orderArr = JSON.parse(customOrderStr);
        orderArr.forEach((id, idx) => { orderMap[id] = idx; });
      } catch (e) {
        console.error('Error parsing order:', e);
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

  // Keyboard shortcut for add modal
  useEffect(() => {
    const handleKeyDown = (evt) => {
      if (evt.key === 'Escape' && showModal) {
        handleCancelTask();
      }
      if ((evt.key === '+' || evt.key === 'n' || evt.key === 'N') && !showModal && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        evt.preventDefault();
        openModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, handleCancelTask]);

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
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

    const orderIds = updatedList.map((item) => item._id);
    localStorage.setItem('tasknote_custom_order', JSON.stringify(orderIds));

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
  };

  // Add / Edit task submission
  const handleAddTask = async (e) => {
    e.preventDefault();
    setIsbtnLoading(true);

    let finalDescription = note.description.trim();
    if (activeModalTab === 'structured' && builderSubtasks.length > 0) {
      finalDescription = builderSubtasks.map((item) => `${item.topic}: ${item.status}`).join(' , ');
    }

    if (isEditing && editingNote) {
      editNote(editingNote._id, note.title, finalDescription, note.tag)
        .then(() => {
          setNote({ title: '', description: '', tag: 'medium' });
          setIsEditing(false);
          setIsbtnLoading(false);
          handleCancelTask();
          const notif = document.querySelector('.notification');
          if (notif) {
            notif.classList.add('-is-shown');
            setTimeout(() => notif.classList.remove('-is-shown'), 1500);
          }
        });
    } else {
      addNote(note.title, finalDescription, note.tag)
        .then(() => {
          setNote({ title: '', description: '', tag: 'medium' });
          playSound(AddTaskSound);
          setIsbtnLoading(false);
          handleCancelTask();
        });
    }
  };

  const onChange = (e) => {
    setNote({ ...note, [e.target.name]: e.target.value });
  };

  const getFlameColor = (tag) => {
    if (tag === 'low') return '#a0aec0';
    if (tag === 'medium') return '#3b82f6';
    if (tag === 'high') return '#ef4444';
    return '#3b82f6';
  };

  // Toggle completion of the entire note
  const toggleNoteCompletion = async (noteItem) => {
    const completed = !noteItem.completed;
    noteItem.completed = completed;
    if (!completed) {
      playSound(UnCompletedTaskSound);
    } else {
      playSound(TaskCompletedSound);
    }
    await updateNoteCompletedStatus(noteItem._id, completed);
  };

  // SILENT subtask click: No annoying edit tone on every click!
  const handleCardSubtaskClick = async (e, noteItem, subtaskIndex) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIndex);
    if (updatedDesc !== noteItem.description) {
      // Intentionally silent per user request (no loud edit sound)
      await editNote(noteItem._id, noteItem.title, updatedDesc, noteItem.tag);
    }
  };

  // Edit Note Trigger
  const updateNote = (currentNote) => {
    setIsEditing(true);
    setShowModal(true);
    setEditingNote(currentNote);
    setNote({
      title: currentNote.title,
      description: currentNote.description,
      tag: currentNote.tag || 'medium',
    });

    const parsed = parseDescription(currentNote.description);
    if (parsed.isStructured && parsed.items.length > 0) {
      setBuilderSubtasks(parsed.items);
      setActiveModalTab('structured');
    } else {
      setBuilderSubtasks([]);
      setActiveModalTab('plaintext');
    }
  };

  // Delete Task Trigger
  const taskDeleted = (event, noteItem) => {
    event.stopPropagation();
    const confirmBox = window.confirm(`Do you really want to delete this note?`);
    if (confirmBox === true) {
      playRandomDeleteSound();
      deleteNote(noteItem._id);
    }
  };

  const highlightMatches = (text, query) => {
    if (!query || typeof text !== 'string') return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span key={index} style={{ background: '#F9B7FF', borderRadius: '3px', padding: '0 2px' }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (searchQuery === '/commits') {
    navigate('/commits');
    setSearchQuery('');
  }

  return (
    <div className="compact-app-wrapper">
      {/* Toast Notification */}
      <div className="notification">
        <i className="fa-solid fa-circle-check"></i> Task saved successfully
      </div>

      <section className="app" ref={taskNoteContainerRef}>
        <div className="tasks">
          {isLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div className="task" key={`skeleton-${index}`}>
                <div className="task-header">
                  <div className="left-side">
                    <Skeleton height={15} borderRadius={15} width={15} />
                    <span className="task-title"><Skeleton width={180} /></span>
                  </div>
                  <div className="right-side">
                    <Skeleton height={18} width={60} />
                  </div>
                </div>
                <div className="task-body">
                  <Skeleton count={2} />
                </div>
                <div className="task-footer">
                  <Skeleton width={140} height={18} />
                </div>
              </div>
            ))
          ) : filteredNotes.length === 0 ? (
            <h3 className="empty-state-text">
              {searchQuery ? 'No search found!' : 'No notes found! Press + to add.'}
            </h3>
          ) : null}

          {filteredNotes.map((noteItem, index) => {
            const isItemDragging = draggingIndex === index;
            const isItemOver = dragOverIndex === index;
            const parsed = parseDescription(noteItem.description);

            return (
              <div
                className={`task ${noteItem.completed ? '-is-completed' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
                data-index={index}
                key={noteItem._id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* Header */}
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

                {/* Body (Compact Subtasks Tracker OR Plain Text) */}
                <div className="task-body">
                  {parsed.isStructured ? (
                    <div className="compact-subtasks-container">
                      {/* Compact Progress Line */}
                      <div className="compact-progress-row">
                        <div className="compact-progress-bar-bg">
                          <div
                            className="compact-progress-bar-fill"
                            style={{
                              width: `${parsed.percentage}%`,
                              background: parsed.percentage === 100 ? '#10b981' : '#bb00ff',
                            }}
                          ></div>
                        </div>
                        <span className="compact-progress-label">
                          {parsed.completedCount}/{parsed.totalCount} ({parsed.percentage}%)
                        </span>
                      </div>

                      {/* Subtask Chips */}
                      <div className="compact-subtask-chips">
                        {parsed.items.map((subItem, sIdx) => {
                          const statusType = getSubtaskStatusType(subItem.status);
                          return (
                            <span
                              key={sIdx}
                              className={`compact-chip status-${statusType}`}
                              onClick={(e) => handleCardSubtaskClick(e, noteItem, sIdx)}
                              title="Click to toggle status (Silent)"
                            >
                              <strong className="chip-topic">{subItem.topic}:</strong> {subItem.status}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="task-description">
                      {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="task-footer">
                  <div className="task-timestamps">
                    <span className="task-timestamp" title="Created date">
                      {noteItem.date}
                    </span>
                    {Boolean(noteItem.updatedDate && (noteItem.isEdited || noteItem.updatedDate !== noteItem.date)) && (
                      <span className="task-timestamp task-timestamp-updated" title="Edited date">
                        {noteItem.updatedDate}
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
      </section>

      {/* SINGLE SIGNATURE FLOATING ADD BUTTON */}
      <button
        type="button"
        className="btn-toggle-modal"
        onClick={openModal}
        title="Add new task (+)"
      >
        <span>+</span>
      </button>

      {/* Scroll to Top Button */}
      {showScrollButton && (
        <button className="scrollToTopButton" onClick={scrollToTop} title="Scroll to Top">
          <ArrowCircleUpSharpIcon />
        </button>
      )}

      {/* COMPACT ADD / EDIT TASK MODAL */}
      {showModal && (
        <div className="modal-backdrop-overlay" onClick={handleCancelTask}>
          <div className="compact-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="compact-modal-header">
              <h3>{isEditing ? 'Edit Task' : 'Add Task'}</h3>
              <button type="button" className="close-modal-x" onClick={handleCancelTask}>✕</button>
            </div>

            <form onSubmit={handleAddTask}>
              <div className="compact-field">
                <label htmlFor="task-title">Title</label>
                <input
                  id="task-title"
                  name="title"
                  type="text"
                  value={note.title}
                  onChange={onChange}
                  minLength={3}
                  placeholder="Task title..."
                  required
                  autoFocus
                />
              </div>

              {/* Modal Tabs: Structured Subtasks vs Text */}
              <div className="compact-field">
                <div className="tab-pill-switcher">
                  <button
                    type="button"
                    className={`tab-pill-btn ${activeModalTab === 'structured' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModalTab('structured');
                      if (builderSubtasks.length === 0 && note.description.trim()) {
                        const p = parseDescription(note.description);
                        if (p.isStructured) setBuilderSubtasks(p.items);
                      }
                    }}
                  >
                    ✨ Subtasks Builder {builderSubtasks.length > 0 && `(${builderSubtasks.length})`}
                  </button>

                  <button
                    type="button"
                    className={`tab-pill-btn ${activeModalTab === 'plaintext' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModalTab('plaintext');
                      if (builderSubtasks.length > 0) syncBuilderToDescription(builderSubtasks);
                    }}
                  >
                    📝 Plain Text
                  </button>
                </div>

                {activeModalTab === 'structured' ? (
                  <div className="compact-builder-wrapper">
                    {/* 1-Click Preset Buttons */}
                    <div className="builder-presets-row">
                      <span className="presets-tag">Quick:</span>
                      <button type="button" onClick={() => handleApplyPresetTemplate('interview')} className="preset-btn">💼 Interview Prep</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('sprint')} className="preset-btn">🚀 Dev Sprint</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('study')} className="preset-btn">📚 Study</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('daily')} className="preset-btn">✅ Daily</button>
                    </div>

                    {/* Inline Add Topic + Status */}
                    <div className="builder-inline-input">
                      <input
                        type="text"
                        placeholder="Subtask topic (e.g. Java, DSA, UI)..."
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtaskToBuilder();
                          }
                        }}
                      />
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                      >
                        <option value="pending">pending</option>
                        <option value="in-progress">in-progress</option>
                        <option value="completed">completed</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddSubtaskToBuilder}
                        disabled={!newTopic.trim()}
                        className="add-subtask-btn"
                      >
                        + Add
                      </button>
                    </div>

                    {/* Subtask items pills */}
                    <div className="builder-pills-list">
                      {builderSubtasks.length === 0 ? (
                        <div className="builder-empty-hint">
                          Click a quick template above or type a topic to add subtasks!
                        </div>
                      ) : (
                        builderSubtasks.map((item, idx) => {
                          const statusType = getSubtaskStatusType(item.status);
                          return (
                            <div className={`builder-chip status-${statusType}`} key={idx}>
                              <span
                                className="builder-chip-text"
                                onClick={() => handleCycleBuilderStatus(idx)}
                                title="Click to cycle status (Pending -> In Progress -> Completed)"
                              >
                                <strong>{item.topic}:</strong> {item.status}
                              </span>
                              <button
                                type="button"
                                className="builder-chip-del"
                                onClick={() => handleRemoveBuilderSubtask(idx)}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <textarea
                    id="task-desc"
                    name="description"
                    value={note.description}
                    rows={3}
                    onChange={onChange}
                    minLength={3}
                    placeholder="Type description or 'Interview: pending , Java: completed'..."
                    required
                  ></textarea>
                )}
              </div>

              {/* Priority */}
              <div className="compact-field">
                <label>Priority</label>
                <div className="priority-options-row">
                  <label className={`priority-pill high ${note.tag === 'high' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="priority"
                      value="high"
                      checked={note.tag === 'high'}
                      onChange={() => setNote({ ...note, tag: 'high' })}
                    />
                    🔥 High
                  </label>

                  <label className={`priority-pill medium ${note.tag === 'medium' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="priority"
                      value="medium"
                      checked={note.tag === 'medium'}
                      onChange={() => setNote({ ...note, tag: 'medium' })}
                    />
                    ⚡ Medium
                  </label>

                  <label className={`priority-pill low ${note.tag === 'low' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="priority"
                      value="low"
                      checked={note.tag === 'low'}
                      onChange={() => setNote({ ...note, tag: 'low' })}
                    />
                    🌱 Low
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="compact-modal-btns">
                {isbtnLoading ? (
                  <div className="loader-box">
                    <DotPulse size={30} color="#bb00ff" />
                  </div>
                ) : (
                  <button
                    disabled={note.title.length < 3 || (activeModalTab === 'plaintext' && note.description.length < 3 && builderSubtasks.length === 0)}
                    className="btn-submit-task"
                    type="submit"
                  >
                    {isEditing ? 'Save note' : 'Add note'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={handleCancelTask}
                  disabled={isbtnLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notescomp;
