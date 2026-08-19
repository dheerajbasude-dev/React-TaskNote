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
// STRUCTURED SUBTASKS & PROGRESS TRACKER UTILITIES
// ============================================================================

export const parseDescription = (desc) => {
  if (!desc || typeof desc !== 'string') {
    return { isStructured: false, items: [], rawText: '', totalCount: 0, completedCount: 0, inProgressCount: 0, percentage: 0 };
  }

  const trimmed = desc.trim();
  if (!trimmed) {
    return { isStructured: false, items: [], rawText: '', totalCount: 0, completedCount: 0, inProgressCount: 0, percentage: 0 };
  }

  // Split by newline or comma
  const parts = trimmed.includes('\n')
    ? trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

  const structuredItems = [];
  let foundStructuredFormat = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Markdown checkbox: "- [x] task"
    const mdMatch = part.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
    if (mdMatch) {
      const isDone = mdMatch[1].toLowerCase() === 'x';
      structuredItems.push({
        id: `subtask-${i}`,
        topic: mdMatch[2].trim(),
        status: isDone ? 'completed' : 'pending',
        raw: part,
      });
      foundStructuredFormat = true;
      continue;
    }

    // Key-value pair: "Topic: status"
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0 && colonIdx < part.length - 1) {
      const topic = part.slice(0, colonIdx).trim();
      const status = part.slice(colonIdx + 1).trim();
      if (topic && status) {
        structuredItems.push({
          id: `subtask-${i}`,
          topic,
          status,
          raw: part,
        });
        foundStructuredFormat = true;
        continue;
      }
    }
  }

  if (foundStructuredFormat && structuredItems.length > 0) {
    const totalCount = structuredItems.length;
    const completedCount = structuredItems.filter((item) => {
      const s = item.status.toLowerCase();
      return s.includes('completed') || s.includes('done') || s === 'finish' || s === 'finished';
    }).length;

    const inProgressCount = structuredItems.filter((item) => {
      const s = item.status.toLowerCase();
      return !s.includes('completed') && !s.includes('done') && (s.includes('progress') || s.includes('--') || s.includes('[') || s.includes('active') || s.includes('doing'));
    }).length;

    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      isStructured: true,
      items: structuredItems,
      rawText: desc,
      totalCount,
      completedCount,
      inProgressCount,
      percentage,
    };
  }

  return {
    isStructured: false,
    items: [],
    rawText: desc,
    totalCount: 0,
    completedCount: 0,
    inProgressCount: 0,
    percentage: 0,
  };
};

export const getSubtaskStatusType = (statusStr) => {
  if (!statusStr) return 'pending';
  const s = statusStr.toLowerCase();
  if (s.includes('completed') || s.includes('done') || s === 'finished' || s === 'complete') {
    return 'completed';
  }
  if (s.includes('progress') || s.includes('doing') || s.includes('active') || s.includes('--') || s.includes('[')) {
    return 'in-progress';
  }
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
// MAIN COMPACT & PREMIUM COMPONENT
// ============================================================================

const Notescomp = ({ searchQuery, setSearchQuery, selectedPriority }) => {
  const playSound = useCallback((soundFile) => {
    try {
      const audio = new Audio(soundFile);
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }, []);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const taskNoteContainerRef = useRef(null);

  // Context API
  const context = useContext(noteContext);
  const { notes, setNotes, getNotes, addNote, editNote, deleteNote, updateNoteCompletedStatus, filteredNotes, setFilteredNotes } = context;
  const navigate = useNavigate();

  // Layout View Mode (Compact Grid vs Compact List)
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('tasknote_view_mode') || 'grid'
  );

  const handleToggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('tasknote_view_mode', mode);
  };

  // Modal, editing and loading states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState({ title: '', description: '', tag: 'medium' });
  const [editingNote, setEditingNote] = useState(null);
  const [isbtnLoading, setIsbtnLoading] = useState(false);

  // Subtask Builder State in Modal
  const [activeModalTab, setActiveModalTab] = useState('structured');
  const [builderSubtasks, setBuilderSubtasks] = useState([]);
  const [newSubtaskTopic, setNewSubtaskTopic] = useState('');
  const [newSubtaskStatus, setNewSubtaskStatus] = useState('pending');
  const [expandedCards, setExpandedCards] = useState({});

  // Drag & Drop State
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setBuilderSubtasks([]);
    setNewSubtaskTopic('');
    setNewSubtaskStatus('pending');
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
    setNewSubtaskTopic('');
    setNewSubtaskStatus('pending');
  };

  const playRandomDeleteSound = () => {
    playSound(Math.random() < 0.5 ? TaskDeleted1Sound : TaskDeleted2Sound);
  };

  // Synchronize builderSubtasks with note.description
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
    if (!newSubtaskTopic.trim()) return;

    const newItem = {
      id: `builder-${Date.now()}-${Math.random()}`,
      topic: newSubtaskTopic.trim(),
      status: newSubtaskStatus || 'pending',
    };

    const updated = [...builderSubtasks, newItem];
    setBuilderSubtasks(updated);
    setNewSubtaskTopic('');
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
        { id: `p-1`, topic: 'Interview', status: 'pending' },
        { id: `p-2`, topic: 'Interview-prep', status: 'pending' },
        { id: `p-3`, topic: 'Java', status: 'pending' },
        { id: `p-4`, topic: 'SpringBoot', status: 'completed' },
        { id: `p-5`, topic: 'Microservice-topics', status: 'pending' },
        { id: `p-6`, topic: 'DSA', status: 'pending' },
        { id: `p-7`, topic: 'System-design', status: 'pending' },
        { id: `p-8`, topic: 'Coding', status: 'pending' },
      ];
    } else if (presetType === 'sprint') {
      items = [
        { id: `p-1`, topic: 'UI/UX Design', status: 'completed' },
        { id: `p-2`, topic: 'Backend API', status: 'in-progress' },
        { id: `p-3`, topic: 'Frontend Integration', status: 'pending' },
        { id: `p-4`, topic: 'Unit Tests', status: 'pending' },
        { id: `p-5`, topic: 'Deployment', status: 'pending' },
      ];
    } else if (presetType === 'study') {
      items = [
        { id: `p-1`, topic: 'Theory & Core', status: 'completed' },
        { id: `p-2`, topic: 'Hands-on Labs', status: 'in-progress' },
        { id: `p-3`, topic: 'Practice Problems', status: 'pending' },
        { id: `p-4`, topic: 'Revision', status: 'pending' },
      ];
    } else if (presetType === 'daily') {
      items = [
        { id: `p-1`, topic: 'Morning Standup', status: 'completed' },
        { id: `p-2`, topic: 'Primary Task Block', status: 'in-progress' },
        { id: `p-3`, topic: 'Code Review', status: 'pending' },
        { id: `p-4`, topic: 'Daily Wrap-up', status: 'pending' },
      ];
    }

    setBuilderSubtasks(items);
    syncBuilderToDescription(items);
    setActiveModalTab('structured');
  };

  // Filter notes based on search query & priority
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

  // Keyboard shortcuts (Escape to close modal, + or n to open modal)
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

  // Drag and Drop
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

  const getPriorityColor = (tag) => {
    if (tag === 'low') return '#10b981';
    if (tag === 'medium') return '#6366f1';
    if (tag === 'high') return '#f43f5e';
    return '#6366f1';
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

  // SILENT Subtask toggle directly from the card (NO LOUD EDIT TONE)
  const handleCardSubtaskClick = async (e, noteItem, subtaskIndex) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIndex);
    if (updatedDesc !== noteItem.description) {
      // Completely silent & frictionless
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
    const confirmBox = window.confirm(`Delete "${noteItem.title}"?`);
    if (confirmBox === true) {
      playRandomDeleteSound();
      deleteNote(noteItem._id);
    }
  };

  // Search matches highlighting
  const highlightMatches = (text, query) => {
    if (!query || typeof text !== 'string') return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span key={index} className="search-highlight-badge">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const toggleCardExpansion = (e, noteId) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  if (searchQuery === '/commits') {
    navigate('/commits');
    setSearchQuery('');
  }

  return (
    <div className="premium-page-wrapper">
      <main className="premium-app-container" ref={taskNoteContainerRef}>
        {/* Dashboard Control Bar */}
        <div className="premium-dashboard-bar">
          <div className="premium-heading-row">
            <h1 className="premium-page-title">
              {selectedPriority === 'All' ? 'All Tasks' : `${selectedPriority} Priority`}
            </h1>
            <span className="premium-count-badge">
              {filteredNotes.length}
            </span>
          </div>

          <div className="premium-bar-actions">
            {/* View Switcher: Grid vs List */}
            <div className="premium-view-switcher">
              <button
                type="button"
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => handleToggleViewMode('grid')}
                title="Grid View"
              >
                <ion-icon name="grid-outline"></ion-icon>
              </button>
              <button
                type="button"
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => handleToggleViewMode('list')}
                title="List View"
              >
                <ion-icon name="list-outline"></ion-icon>
              </button>
            </div>

            {/* ONLY ONE CLEAN ADD TASK BUTTON */}
            <button
              type="button"
              className="premium-add-task-btn"
              onClick={openModal}
              title="Add task (+)"
            >
              <ion-icon name="add"></ion-icon>
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Task Cards: Grid vs List Mode */}
        {isLoading ? (
          <div className="premium-tasks-container view-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="premium-card skeleton-card" key={`skeleton-${index}`}>
                <div className="premium-card-header">
                  <Skeleton circle height={20} width={20} />
                  <Skeleton height={18} width="60%" />
                </div>
                <div className="premium-card-body">
                  <Skeleton count={2} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="premium-empty-state">
            <div className="empty-icon-box">
              <ion-icon name="sparkles-outline"></ion-icon>
            </div>
            <h3 className="empty-title">
              {searchQuery ? 'No matching tasks' : 'No tasks found'}
            </h3>
            <p className="empty-desc">
              {searchQuery
                ? `No tasks match "${searchQuery}".`
                : 'Click "New Task" above to add your first note or subtask tracker.'}
            </p>
            <button type="button" className="empty-create-btn" onClick={openModal}>
              <ion-icon name="add"></ion-icon>
              <span>New Task</span>
            </button>
          </div>
        ) : (
          <div className={`premium-tasks-container view-${viewMode}`}>
            {filteredNotes.map((noteItem, index) => {
              const isItemDragging = draggingIndex === index;
              const isItemOver = dragOverIndex === index;
              const parsed = parseDescription(noteItem.description);
              const isExpanded = Boolean(expandedCards[noteItem._id]);
              const visibleItems = isExpanded ? parsed.items : parsed.items.slice(0, 6);
              const hasMoreItems = parsed.items.length > 6;

              return (
                <article
                  className={`premium-card ${noteItem.completed ? 'is-completed' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
                  data-index={index}
                  key={noteItem._id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    '--card-accent': getPriorityColor(noteItem.tag),
                  }}
                >
                  <div className="premium-left-accent"></div>

                  <div className="premium-card-main">
                    {/* Header Row */}
                    <div className="premium-card-header">
                      <div className="premium-title-group">
                        <span
                          className="premium-priority-badge"
                          style={{
                            color: getPriorityColor(noteItem.tag),
                            backgroundColor: `${getPriorityColor(noteItem.tag)}12`,
                            borderColor: `${getPriorityColor(noteItem.tag)}30`,
                          }}
                        >
                          {(noteItem.tag || 'medium').toUpperCase()}
                        </span>
                        <h2 className={`premium-title ${noteItem.completed ? 'strike' : ''}`}>
                          {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                        </h2>
                      </div>

                      {/* Action buttons */}
                      <div className="premium-actions">
                        <button
                          type="button"
                          className="premium-btn edit"
                          title="Edit task"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNote(noteItem);
                          }}
                        >
                          <ion-icon name="create-outline"></ion-icon>
                        </button>

                        <button
                          type="button"
                          className={`premium-btn complete ${noteItem.completed ? 'active' : ''}`}
                          title={noteItem.completed ? 'Mark pending' : 'Mark done'}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNoteCompletion(noteItem);
                          }}
                        >
                          <ion-icon name={noteItem.completed ? 'checkmark-circle' : 'ellipse-outline'}></ion-icon>
                        </button>

                        <button
                          type="button"
                          className="premium-btn delete"
                          title="Delete task"
                          onClick={(e) => taskDeleted(e, noteItem)}
                        >
                          <ion-icon name="trash-outline"></ion-icon>
                        </button>
                      </div>
                    </div>

                    {/* Body: Structured Subtasks Chips or Plain Text */}
                    <div className="premium-card-body">
                      {parsed.isStructured ? (
                        <div className="premium-subtasks-wrapper">
                          {/* Mini progress line */}
                          <div className="premium-progress-row">
                            <div className="premium-progress-track">
                              <div
                                className="premium-progress-bar"
                                style={{
                                  width: `${parsed.percentage}%`,
                                  background: parsed.percentage === 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #a855f7)',
                                }}
                              ></div>
                            </div>
                            <span className="premium-progress-text">
                              {parsed.completedCount}/{parsed.totalCount} ({parsed.percentage}%)
                            </span>
                          </div>

                          {/* Subtask Chips */}
                          <div className="premium-chips-grid">
                            {visibleItems.map((subItem, sIdx) => {
                              const statusType = getSubtaskStatusType(subItem.status);
                              return (
                                <button
                                  key={subItem.id || sIdx}
                                  type="button"
                                  className={`premium-subtask-chip status-${statusType}`}
                                  onClick={(e) => handleCardSubtaskClick(e, noteItem, sIdx)}
                                  title={`Click to cycle status (Now: ${subItem.status})`}
                                >
                                  <span className="chip-icon">
                                    {statusType === 'completed' && <ion-icon name="checkmark-circle"></ion-icon>}
                                    {statusType === 'in-progress' && <ion-icon name="flash"></ion-icon>}
                                    {statusType === 'pending' && <ion-icon name="ellipse-outline"></ion-icon>}
                                  </span>
                                  <span className="chip-topic">
                                    {searchQuery ? highlightMatches(subItem.topic, searchQuery) : subItem.topic}:
                                  </span>
                                  <span className="chip-status">
                                    {searchQuery ? highlightMatches(subItem.status, searchQuery) : subItem.status}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {hasMoreItems && (
                            <button
                              type="button"
                              className="premium-expand-btn"
                              onClick={(e) => toggleCardExpansion(e, noteItem._id)}
                            >
                              <span>{isExpanded ? 'Show less' : `+${parsed.items.length - 6} more`}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="premium-plain-desc">
                          {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="premium-card-footer">
                      <div className="premium-footer-meta">
                        <span className="premium-date" title={`Created ${noteItem.date}`}>
                          <ion-icon name="calendar-outline"></ion-icon> {noteItem.date}
                        </span>
                        {Boolean(noteItem.updatedDate && (noteItem.isEdited || noteItem.updatedDate !== noteItem.date)) && (
                          <span className="premium-edited-badge" title={`Edited ${noteItem.updatedDate}`}>
                            • edited
                          </span>
                        )}
                      </div>
                      <span className="premium-idx">#{index + 1}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Scroll to Top */}
      {showScrollButton && (
        <button type="button" className="premium-scroll-top" onClick={scrollToTop} title="Scroll Top">
          <ArrowCircleUpSharpIcon />
        </button>
      )}

      {/* =================================================================== */}
      {/* PREMIUM ADD / EDIT MODAL                                            */}
      {/* =================================================================== */}
      {showModal && (
        <div className="premium-modal-overlay" onClick={handleCancelTask}>
          <div className="premium-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="premium-modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <ion-icon name={isEditing ? 'create-outline' : 'sparkles-outline'}></ion-icon>
                </div>
                <h3>{isEditing ? 'Edit Task' : 'New Task'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={handleCancelTask}>
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            <form className="premium-modal-form" onSubmit={handleAddTask}>
              {/* Title & Priority Row */}
              <div className="modal-top-row">
                <input
                  id="task-title"
                  name="title"
                  type="text"
                  className="modal-title-input"
                  value={note.title}
                  onChange={onChange}
                  minLength={3}
                  placeholder="Task title (e.g. Job Prep, Project Release)..."
                  required
                  autoFocus
                />

                {/* Priority Selector Pills */}
                <div className="modal-priority-pills">
                  <button
                    type="button"
                    className={`modal-p-btn high ${note.tag === 'high' ? 'active' : ''}`}
                    onClick={() => setNote({ ...note, tag: 'high' })}
                  >
                    High
                  </button>
                  <button
                    type="button"
                    className={`modal-p-btn med ${note.tag === 'medium' ? 'active' : ''}`}
                    onClick={() => setNote({ ...note, tag: 'medium' })}
                  >
                    Med
                  </button>
                  <button
                    type="button"
                    className={`modal-p-btn low ${note.tag === 'low' ? 'active' : ''}`}
                    onClick={() => setNote({ ...note, tag: 'low' })}
                  >
                    Low
                  </button>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="modal-subtasks-section">
                <div className="modal-tabs-compact">
                  <button
                    type="button"
                    className={`tab-btn ${activeModalTab === 'structured' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModalTab('structured');
                      if (builderSubtasks.length === 0 && note.description.trim()) {
                        const p = parseDescription(note.description);
                        if (p.isStructured) setBuilderSubtasks(p.items);
                      }
                    }}
                  >
                    Subtask Tracker ({builderSubtasks.length})
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeModalTab === 'plaintext' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModalTab('plaintext');
                      if (builderSubtasks.length > 0) {
                        syncBuilderToDescription(builderSubtasks);
                      }
                    }}
                  >
                    Plain Notes
                  </button>
                </div>

                {activeModalTab === 'structured' ? (
                  <div className="modal-builder-wrap">
                    {/* 1-Click Templates */}
                    <div className="modal-templates-row">
                      <span className="templates-label">⚡ Presets:</span>
                      <button type="button" onClick={() => handleApplyPresetTemplate('interview')}>💼 Interview Prep</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('sprint')}>🚀 Sprint</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('study')}>📚 Study</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('daily')}>✅ Daily</button>
                    </div>

                    {/* Quick Add Row */}
                    <div className="modal-quick-add-row">
                      <input
                        type="text"
                        placeholder="Add subtask topic & press Enter..."
                        value={newSubtaskTopic}
                        onChange={(e) => setNewSubtaskTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtaskToBuilder();
                          }
                        }}
                      />
                      <select
                        value={newSubtaskStatus}
                        onChange={(e) => setNewSubtaskStatus(e.target.value)}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="in-progress">⚡ In Progress</option>
                        <option value="completed">✅ Completed</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddSubtaskToBuilder}
                        disabled={!newSubtaskTopic.trim()}
                      >
                        Add
                      </button>
                    </div>

                    {/* Subtasks Item List */}
                    <div className="modal-subtasks-scroll">
                      {builderSubtasks.length === 0 ? (
                        <div className="modal-empty-hint">
                          Type a subtask topic above or click a 1-click preset!
                        </div>
                      ) : (
                        builderSubtasks.map((item, idx) => {
                          const statusType = getSubtaskStatusType(item.status);
                          return (
                            <div className="modal-subtask-row" key={item.id || idx}>
                              <span className="row-num">{idx + 1}.</span>
                              <input
                                type="text"
                                className="row-topic-input"
                                value={item.topic}
                                onChange={(e) => {
                                  const updated = [...builderSubtasks];
                                  updated[idx].topic = e.target.value;
                                  setBuilderSubtasks(updated);
                                  syncBuilderToDescription(updated);
                                }}
                              />
                              <button
                                type="button"
                                className={`row-status-btn status-${statusType}`}
                                onClick={() => handleCycleBuilderStatus(idx)}
                                title="Click to cycle status"
                              >
                                {statusType === 'completed' && 'Completed'}
                                {statusType === 'in-progress' && 'In Progress'}
                                {statusType === 'pending' && 'Pending'}
                              </button>
                              <button
                                type="button"
                                className="row-del-btn"
                                onClick={() => handleRemoveBuilderSubtask(idx)}
                                title="Delete"
                              >
                                <ion-icon name="trash-outline"></ion-icon>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="modal-plain-wrap">
                    <textarea
                      id="task-desc"
                      name="description"
                      className="modal-plain-textarea"
                      value={note.description}
                      rows={4}
                      onChange={onChange}
                      minLength={3}
                      placeholder="Notes or freeform description..."
                      required
                    ></textarea>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="premium-modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={handleCancelTask}
                  disabled={isbtnLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-save-btn"
                  disabled={isbtnLoading || note.title.length < 3}
                >
                  {isbtnLoading ? (
                    <DotPulse size={20} color="#ffffff" />
                  ) : (
                    <span>{isEditing ? 'Save Changes' : 'Create Task'}</span>
                  )}
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
