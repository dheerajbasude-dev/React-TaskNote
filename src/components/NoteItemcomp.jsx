import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
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

  // Determine split strategy: newline or comma
  const parts = trimmed.includes('\n')
    ? trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

  const structuredItems = [];
  let foundStructuredFormat = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Check for markdown checkbox: "- [x] task" or "- [ ] task"
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

    // Check for "Topic: status" or "Topic: 12--pending[14:25]"
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
    // Was completed -> back to pending
    if (item.status.includes('--')) {
      newStatus = item.status.replace(/completed/gi, 'pending');
    } else {
      newStatus = 'pending';
    }
  }

  parsed.items[targetIndex].status = newStatus;

  // Re-serialize keeping standard comma spacing
  return parsed.items.map((it) => `${it.topic}: ${it.status}`).join(' , ');
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Notescomp = ({ searchQuery, setSearchQuery, selectedPriority }) => {
  // Sound player helper
  const playSound = useCallback((soundFile) => {
    try {
      const audio = new Audio(soundFile);
      audio.play().catch(() => {
        // Silently catch autoplay browser restrictions
      });
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }, []);

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

  // Subtask Builder State in Modal
  const [activeModalTab, setActiveModalTab] = useState('structured'); // 'structured' | 'plaintext'
  const [builderSubtasks, setBuilderSubtasks] = useState([]);
  const [newSubtaskTopic, setNewSubtaskTopic] = useState('');
  const [newSubtaskStatus, setNewSubtaskStatus] = useState('pending');
  const [expandedCards, setExpandedCards] = useState({}); // noteId -> boolean

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

  // Sound helper for delete
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
        { id: `p-1`, topic: 'Theory & Core Concepts', status: 'completed' },
        { id: `p-2`, topic: 'Hands-on Coding Labs', status: 'in-progress' },
        { id: `p-3`, topic: 'Practice Exercises', status: 'pending' },
        { id: `p-4`, topic: 'Final Revision', status: 'pending' },
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
      const updated = notes.find((n) => n._id === spotlightNote._id);
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
            playSound(AddTaskSound);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerPreset, playSound]);

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

  // Keyboard shortcuts
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

      if ((evt.key === '+' || evt.key === 'n' || evt.key === 'N') && !showModal && !spotlightNote && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        evt.preventDefault();
        openModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, spotlightNote, handleCancelTask]);

  // Spotlight navigation
  const goToAdjacentSpotlight = (direction) => {
    if (!spotlightNote || filteredNotes.length === 0) return;
    const currentIndex = filteredNotes.findIndex((n) => n._id === spotlightNote._id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + direction + filteredNotes.length) % filteredNotes.length;
    setSpotlightNote(filteredNotes[nextIndex]);
  };

  const openSpotlight = (noteItem) => {
    setSpotlightNote(noteItem);
    setTimerDuration(25);
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

    // Save custom order to localStorage
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
          playSound(EditTaskSound);
          showToastNotification('Task edited successfully');
        });
    } else {
      addNote(note.title, finalDescription, note.tag)
        .then(() => {
          setNote({ title: '', description: '', tag: 'medium' });
          playSound(AddTaskSound);
          setIsbtnLoading(false);
          handleCancelTask();
          showToastNotification('Task created successfully');
        });
    }
  };

  const [notificationMsg, setNotificationMsg] = useState('');
  const showToastNotification = (msg) => {
    setNotificationMsg(msg);
    const notificationEl = document.querySelector('.modern-notification-banner');
    if (notificationEl) {
      notificationEl.classList.add('-is-shown');
      setTimeout(() => notificationEl.classList.remove('-is-shown'), 2000);
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

  const getPriorityColor = (tag) => {
    if (tag === 'low') return '#10b981';
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

  // Interactive Subtask toggle directly from the card
  const handleCardSubtaskClick = async (e, noteItem, subtaskIndex) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIndex);
    if (updatedDesc !== noteItem.description) {
      playSound(EditTaskSound);
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

    // Parse subtasks into builder state
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
      if (spotlightNote && spotlightNote._id === noteItem._id) {
        closeSpotlight();
      }
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

  // Toggle card expansion for long subtask lists
  const toggleCardExpansion = (e, noteId) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  // Redirect if search is /commits
  if (searchQuery === '/commits') {
    navigate('/commits');
    setSearchQuery('');
  }

  // Current spotlight index
  const currentSpotlightIndex = spotlightNote
    ? filteredNotes.findIndex((n) => n._id === spotlightNote._id)
    : -1;

  const currentSpotlightParsed = useMemo(() => {
    return spotlightNote ? parseDescription(spotlightNote.description) : null;
  }, [spotlightNote]);

  return (
    <div className="tasknote-page-wrapper">
      {/* Toast Notification Banner */}
      <div className="modern-notification-banner">
        <ion-icon name="checkmark-circle"></ion-icon>
        <span>{notificationMsg || 'Operation successful'}</span>
      </div>

      <main className="modern-app-container" ref={taskNoteContainerRef}>
        {/* Top Control & Stats Header */}
        <div className="tasks-dashboard-header">
          <div className="tasks-dashboard-title-group">
            <h1 className="tasks-dashboard-heading">
              {selectedPriority === 'All' ? 'All Tasks' : `${selectedPriority} Priority Tasks`}
            </h1>
            <span className="tasks-dashboard-count">
              {filteredNotes.length} {filteredNotes.length === 1 ? 'task' : 'tasks'} found
            </span>
          </div>

          <div className="tasks-dashboard-actions">
            <button
              type="button"
              className="quick-add-task-btn"
              onClick={openModal}
              title="Add new task (or press '+')"
            >
              <ion-icon name="add-circle"></ion-icon>
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div className="modern-tasks-grid">
          {isLoading ? (
            Array.from({ length: 6 }, (_, index) => (
              <div className="modern-task-card skeleton-card" key={`skeleton-${index}`}>
                <div className="card-top-row">
                  <Skeleton circle height={24} width={24} />
                  <Skeleton height={20} width="60%" />
                </div>
                <div className="card-body-skeleton">
                  <Skeleton count={3} />
                </div>
                <div className="card-footer-skeleton">
                  <Skeleton height={16} width="40%" />
                </div>
              </div>
            ))
          ) : filteredNotes.length === 0 ? (
            <div className="modern-empty-state">
              <div className="empty-state-illustration">
                <ion-icon name="sparkles"></ion-icon>
              </div>
              <h3 className="empty-state-title">
                {searchQuery ? 'No matching tasks found' : 'No tasks in this list yet'}
              </h3>
              <p className="empty-state-subtitle">
                {searchQuery
                  ? `Try clearing your search query "${searchQuery}" or priority filter.`
                  : 'Start tracking your projects, interview prep, or daily goals now.'}
              </p>
              <button type="button" className="empty-state-create-btn" onClick={openModal}>
                <ion-icon name="add-outline"></ion-icon>
                <span>Create Your First Task</span>
              </button>
            </div>
          ) : null}

          {filteredNotes.map((noteItem, index) => {
            const isItemDragging = draggingIndex === index;
            const isItemOver = dragOverIndex === index;
            const parsed = parseDescription(noteItem.description);
            const isExpanded = Boolean(expandedCards[noteItem._id]);
            const visibleItems = isExpanded ? parsed.items : parsed.items.slice(0, 6);
            const hasMoreItems = parsed.items.length > 6;

            return (
              <article
                className={`modern-task-card ${noteItem.completed ? 'is-completed' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
                data-index={index}
                key={noteItem._id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  '--card-priority-color': getPriorityColor(noteItem.tag),
                }}
              >
                {/* Accent Top Border */}
                <div className="card-priority-accent-bar"></div>

                {/* Card Header */}
                <div className="card-header">
                  <div className="card-priority-badge-group">
                    <span
                      className="card-priority-pill"
                      style={{
                        backgroundColor: `${getPriorityColor(noteItem.tag)}15`,
                        color: getPriorityColor(noteItem.tag),
                        borderColor: `${getPriorityColor(noteItem.tag)}40`,
                      }}
                    >
                      <ion-icon name="flame"></ion-icon>
                      <span>{(noteItem.tag || 'medium').toUpperCase()}</span>
                    </span>

                    {noteItem.completed && (
                      <span className="card-status-pill completed">
                        <ion-icon name="checkmark-done-circle"></ion-icon>
                        <span>Done</span>
                      </span>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="card-actions-group">
                    <button
                      type="button"
                      className="card-action-btn spotlight-btn"
                      title="Open Spotlight Focus Mode"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSpotlight(noteItem);
                      }}
                    >
                      <ion-icon name="scan-outline"></ion-icon>
                    </button>

                    <button
                      type="button"
                      className="card-action-btn edit-btn"
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
                      className={`card-action-btn complete-btn ${noteItem.completed ? 'is-active' : ''}`}
                      title={noteItem.completed ? 'Mark uncompleted' : 'Mark completed'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNoteCompletion(noteItem);
                      }}
                    >
                      <ion-icon name={noteItem.completed ? 'checkmark-circle' : 'ellipse-outline'}></ion-icon>
                    </button>

                    <button
                      type="button"
                      className="card-action-btn delete-btn"
                      title="Delete task"
                      onClick={(e) => taskDeleted(e, noteItem)}
                    >
                      <ion-icon name="trash-outline"></ion-icon>
                    </button>
                  </div>
                </div>

                {/* Card Title */}
                <div className="card-title-row">
                  <h2 className={`card-title ${noteItem.completed ? 'title-strikethrough' : ''}`}>
                    {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                  </h2>
                </div>

                {/* Card Body (Structured Subtasks Tracker OR Plain Text) */}
                <div className="card-body">
                  {parsed.isStructured ? (
                    <div className="card-subtasks-wrapper">
                      {/* Subtasks Progress Header */}
                      <div className="subtasks-progress-header">
                        <div className="subtasks-count-label">
                          <ion-icon name="list-circle-outline"></ion-icon>
                          <span>
                            Progress: <strong>{parsed.completedCount}</strong> of {parsed.totalCount} subtasks
                          </span>
                        </div>
                        <span className={`subtasks-percentage-badge ${parsed.percentage === 100 ? 'done' : ''}`}>
                          {parsed.percentage}%
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="subtasks-progress-track">
                        <div
                          className="subtasks-progress-fill"
                          style={{
                            width: `${parsed.percentage}%`,
                            background: parsed.percentage === 100 ? '#10b981' : 'linear-gradient(90deg, #7c3aed, #ec4899)',
                          }}
                        ></div>
                      </div>

                      {/* Interactive Subtask Chips */}
                      <div className="subtask-chips-grid">
                        {visibleItems.map((subItem, sIdx) => {
                          const statusType = getSubtaskStatusType(subItem.status);
                          return (
                            <button
                              key={subItem.id || sIdx}
                              type="button"
                              className={`subtask-interactive-chip status-${statusType}`}
                              onClick={(e) => handleCardSubtaskClick(e, noteItem, sIdx)}
                              title={`Click to toggle status (Currently: ${subItem.status})`}
                            >
                              <span className="subtask-chip-icon">
                                {statusType === 'completed' && <ion-icon name="checkmark-circle"></ion-icon>}
                                {statusType === 'in-progress' && <ion-icon name="flash"></ion-icon>}
                                {statusType === 'pending' && <ion-icon name="time-outline"></ion-icon>}
                              </span>
                              <span className="subtask-chip-topic">
                                {searchQuery ? highlightMatches(subItem.topic, searchQuery) : subItem.topic}:
                              </span>
                              <span className="subtask-chip-status">
                                {searchQuery ? highlightMatches(subItem.status, searchQuery) : subItem.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Show More / Show Less for Long Lists */}
                      {hasMoreItems && (
                        <button
                          type="button"
                          className="subtasks-expand-toggle-btn"
                          onClick={(e) => toggleCardExpansion(e, noteItem._id)}
                        >
                          <span>{isExpanded ? 'Show less' : `+ ${parsed.items.length - 6} more subtasks`}</span>
                          <ion-icon name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}></ion-icon>
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="card-plain-description">
                      {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="card-footer">
                  <div className="card-timestamps-group">
                    <span className="card-timestamp" title={`Created on ${noteItem.date}`}>
                      <ion-icon name="calendar-outline"></ion-icon>
                      <span>{noteItem.date}</span>
                    </span>
                    {Boolean(noteItem.updatedDate && (noteItem.isEdited || noteItem.updatedDate !== noteItem.date)) && (
                      <span className="card-timestamp card-timestamp-edited" title={`Edited on ${noteItem.updatedDate}`}>
                        <ion-icon name="pencil-outline"></ion-icon>
                        <span>{noteItem.updatedDate}</span>
                      </span>
                    )}
                  </div>

                  <span className="card-index-indicator" title="Task position">
                    #{index + 1}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* Floating Action Button (Mobile & Quick Add) */}
      <button
        type="button"
        className="modern-floating-action-btn"
        onClick={openModal}
        title="Add new task (+)"
        aria-label="Add new task"
      >
        <ion-icon name="add"></ion-icon>
      </button>

      {/* Scroll to Top Button */}
      {showScrollButton && (
        <button type="button" className="modern-scroll-top-btn" onClick={scrollToTop} title="Scroll to Top">
          <ArrowCircleUpSharpIcon />
        </button>
      )}

      {/* =================================================================== */}
      {/* ADD / EDIT TASK MODAL WITH STRUCTURED SUBTASK BUILDER               */}
      {/* =================================================================== */}
      {showModal && (
        <div className="modern-modal-overlay" onClick={handleCancelTask}>
          <div className="modern-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modern-modal-header">
              <div className="modal-header-title-group">
                <div className="modal-icon-badge">
                  <ion-icon name={isEditing ? 'create-outline' : 'sparkles-outline'}></ion-icon>
                </div>
                <div>
                  <h2 className="modal-title">{isEditing ? 'Edit Task & Subtasks' : 'Create New Task'}</h2>
                  <p className="modal-subtitle">
                    {isEditing ? 'Update task details, checklist, or priority' : 'Add a structured subtask tracker or freeform notes'}
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={handleCancelTask} title="Close (Esc)">
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            {/* Modal Form */}
            <form className="modern-modal-form" onSubmit={handleAddTask}>
              {/* Task Title Input */}
              <div className="form-group">
                <label htmlFor="task-title" className="form-label">
                  Task Title <span className="required-star">*</span>
                </label>
                <input
                  id="task-title"
                  name="title"
                  type="text"
                  className="modern-form-input"
                  value={note.title}
                  onChange={onChange}
                  minLength={3}
                  placeholder="e.g. Learning job progress, Sprint Dev, Project Alpha..."
                  required
                  autoFocus
                />
              </div>

              {/* Priority Selector Cards */}
              <div className="form-group">
                <label className="form-label">Priority Level</label>
                <div className="modal-priority-grid">
                  <label className={`priority-card high ${note.tag === 'high' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="priority"
                      value="high"
                      checked={note.tag === 'high'}
                      onChange={() => setNote({ ...note, tag: 'high' })}
                    />
                    <ion-icon name="flame" class="priority-icon"></ion-icon>
                    <span className="priority-card-title">High</span>
                  </label>

                  <label className={`priority-card medium ${note.tag === 'medium' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="priority"
                      value="medium"
                      checked={note.tag === 'medium'}
                      onChange={() => setNote({ ...note, tag: 'medium' })}
                    />
                    <ion-icon name="flash" class="priority-icon"></ion-icon>
                    <span className="priority-card-title">Medium</span>
                  </label>

                  <label className={`priority-card low ${note.tag === 'low' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="priority"
                      value="low"
                      checked={note.tag === 'low'}
                      onChange={() => setNote({ ...note, tag: 'low' })}
                    />
                    <ion-icon name="leaf" class="priority-icon"></ion-icon>
                    <span className="priority-card-title">Low</span>
                  </label>
                </div>
              </div>

              {/* Modal Tabs: Structured Subtasks Tracker vs Plain Text */}
              <div className="form-group">
                <div className="modal-tabs-header">
                  <div className="modal-tabs-pill-group">
                    <button
                      type="button"
                      className={`modal-tab-pill ${activeModalTab === 'structured' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveModalTab('structured');
                        if (builderSubtasks.length === 0 && note.description.trim()) {
                          const p = parseDescription(note.description);
                          if (p.isStructured) setBuilderSubtasks(p.items);
                        }
                      }}
                    >
                      <ion-icon name="list-outline"></ion-icon>
                      <span>Subtask Tracker Builder</span>
                      {builderSubtasks.length > 0 && <span className="tab-count">{builderSubtasks.length}</span>}
                    </button>

                    <button
                      type="button"
                      className={`modal-tab-pill ${activeModalTab === 'plaintext' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveModalTab('plaintext');
                        if (builderSubtasks.length > 0) {
                          syncBuilderToDescription(builderSubtasks);
                        }
                      }}
                    >
                      <ion-icon name="document-text-outline"></ion-icon>
                      <span>Freeform Text</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: STRUCTURED SUBTASK TRACKER BUILDER */}
                {activeModalTab === 'structured' && (
                  <div className="structured-builder-container">
                    {/* Quick Preset Templates */}
                    <div className="builder-preset-templates-row">
                      <span className="presets-label">⚡ 1-Click Templates:</span>
                      <div className="presets-chips-group">
                        <button
                          type="button"
                          className="preset-template-chip"
                          onClick={() => handleApplyPresetTemplate('interview')}
                          title="Interview Prep (DSA, System Design, Java, SpringBoot...)"
                        >
                          💼 Job Interview Prep
                        </button>
                        <button
                          type="button"
                          className="preset-template-chip"
                          onClick={() => handleApplyPresetTemplate('sprint')}
                          title="Sprint Development (UI, API, Integration, Tests)"
                        >
                          🚀 Dev Sprint
                        </button>
                        <button
                          type="button"
                          className="preset-template-chip"
                          onClick={() => handleApplyPresetTemplate('study')}
                          title="Study Tracker (Theory, Labs, Exercises)"
                        >
                          📚 Study Session
                        </button>
                        <button
                          type="button"
                          className="preset-template-chip"
                          onClick={() => handleApplyPresetTemplate('daily')}
                          title="Daily Routine Goals"
                        >
                          ✅ Daily Goals
                        </button>
                      </div>
                    </div>

                    {/* Add Subtask Input Form Row */}
                    <div className="builder-add-input-bar">
                      <input
                        type="text"
                        className="builder-topic-input"
                        placeholder="Subtask topic (e.g. Java, System Design, Microservices)..."
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
                        className="builder-status-select"
                        value={newSubtaskStatus}
                        onChange={(e) => setNewSubtaskStatus(e.target.value)}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="in-progress">⚡ In Progress</option>
                        <option value="completed">✅ Completed</option>
                        <option value="12--pending[14:25]">⏱️ Time / Custom</option>
                      </select>

                      <button
                        type="button"
                        className="builder-add-btn"
                        onClick={handleAddSubtaskToBuilder}
                        disabled={!newSubtaskTopic.trim()}
                      >
                        <ion-icon name="add"></ion-icon>
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Subtasks List in Builder */}
                    <div className="builder-subtasks-list">
                      {builderSubtasks.length === 0 ? (
                        <div className="builder-empty-notice">
                          <ion-icon name="add-circle-outline"></ion-icon>
                          <span>No subtasks added yet. Type a topic above or click a 1-Click Template!</span>
                        </div>
                      ) : (
                        builderSubtasks.map((item, idx) => {
                          const statusType = getSubtaskStatusType(item.status);
                          return (
                            <div className="builder-subtask-item-row" key={item.id || idx}>
                              <span className="builder-item-number">{idx + 1}.</span>
                              <input
                                type="text"
                                className="builder-item-topic-field"
                                value={item.topic}
                                onChange={(e) => {
                                  const updated = [...builderSubtasks];
                                  updated[idx].topic = e.target.value;
                                  setBuilderSubtasks(updated);
                                  syncBuilderToDescription(updated);
                                }}
                              />

                              {/* Status Cycler Button */}
                              <button
                                type="button"
                                className={`builder-item-status-btn status-${statusType}`}
                                onClick={() => handleCycleBuilderStatus(idx)}
                                title="Click to cycle status (Pending -> In Progress -> Completed)"
                              >
                                {statusType === 'completed' && '✅ Completed'}
                                {statusType === 'in-progress' && '⚡ In Progress'}
                                {statusType === 'pending' && '⏳ Pending'}
                              </button>

                              {/* Remove Button */}
                              <button
                                type="button"
                                className="builder-item-delete-btn"
                                onClick={() => handleRemoveBuilderSubtask(idx)}
                                title="Remove subtask"
                              >
                                <ion-icon name="trash-outline"></ion-icon>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: FREEFORM PLAIN TEXT */}
                {activeModalTab === 'plaintext' && (
                  <div className="plaintext-container">
                    <textarea
                      id="task-desc"
                      name="description"
                      className="modern-form-textarea"
                      value={note.description}
                      rows={4}
                      onChange={(e) => {
                        onChange(e);
                        handleDescriptionInput(e);
                      }}
                      minLength={3}
                      placeholder="Enter task description or key-value subtasks (e.g. Interview: pending , Java: completed)..."
                      required
                    ></textarea>
                    <span className="plaintext-hint">
                      💡 Tip: You can type formatted subtasks like <code>Interview: pending , DSA: completed</code> to enable interactive badges!
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="modern-modal-footer">
                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={handleCancelTask}
                  disabled={isbtnLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-submit-button"
                  disabled={isbtnLoading || note.title.length < 3 || (activeModalTab === 'plaintext' && note.description.length < 3 && builderSubtasks.length === 0)}
                >
                  {isbtnLoading ? (
                    <DotPulse size={24} color="#ffffff" />
                  ) : (
                    <>
                      <ion-icon name={isEditing ? 'checkmark-done' : 'add-circle'}></ion-icon>
                      <span>{isEditing ? 'Save Changes' : 'Create Task'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SPOTLIGHT FOCUS WORKSPACE & POMODORO TIMER                          */}
      {/* =================================================================== */}
      {spotlightNote && (
        <div className="spotlight-overlay" onClick={closeSpotlight}>
          <div className="spotlight-container" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="spotlight-header">
              <div className="spotlight-badge-container">
                <span
                  className="spotlight-priority-badge"
                  style={{
                    borderColor: getPriorityColor(spotlightNote.tag),
                    color: getPriorityColor(spotlightNote.tag),
                    boxShadow: `0 0 16px ${getPriorityColor(spotlightNote.tag)}33`,
                  }}
                >
                  <ion-icon name="flame"></ion-icon>
                  <span>{(spotlightNote.tag || 'medium').toUpperCase()} PRIORITY</span>
                </span>
                <span className="spotlight-counter">
                  Task {currentSpotlightIndex + 1} of {filteredNotes.length}
                </span>
              </div>
              <button className="spotlight-close-btn" onClick={closeSpotlight} title="Close Spotlight (Esc)">
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            {/* Body */}
            <div className="spotlight-body">
              <div className="spotlight-title-row">
                <h1 className={`spotlight-title ${spotlightNote.completed ? 'is-completed' : ''}`}>
                  {spotlightNote.title}
                </h1>
              </div>

              {/* Subtasks Progress & Checklist in Spotlight */}
              {currentSpotlightParsed && currentSpotlightParsed.isStructured ? (
                <div className="spotlight-subtasks-box">
                  <div className="spotlight-subtasks-header">
                    <span className="spotlight-subtasks-title">
                      Subtasks Tracker ({currentSpotlightParsed.completedCount}/{currentSpotlightParsed.totalCount} Done)
                    </span>
                    <span className="spotlight-subtasks-percent">{currentSpotlightParsed.percentage}%</span>
                  </div>

                  <div className="spotlight-progress-track">
                    <div
                      className="spotlight-progress-fill"
                      style={{ width: `${currentSpotlightParsed.percentage}%` }}
                    ></div>
                  </div>

                  <div className="spotlight-checklist">
                    {currentSpotlightParsed.items.map((item, idx) => {
                      const statusType = getSubtaskStatusType(item.status);
                      return (
                        <div
                          key={idx}
                          className={`spotlight-check-item status-${statusType}`}
                          onClick={(e) => handleCardSubtaskClick(e, spotlightNote, idx)}
                          title="Click to toggle status"
                        >
                          <div className="spotlight-check-icon">
                            {statusType === 'completed' && <ion-icon name="checkmark-circle"></ion-icon>}
                            {statusType === 'in-progress' && <ion-icon name="flash"></ion-icon>}
                            {statusType === 'pending' && <ion-icon name="ellipse-outline"></ion-icon>}
                          </div>
                          <span className="spotlight-check-topic">{item.topic}</span>
                          <span className="spotlight-check-status">{item.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="spotlight-desc-box">
                  <p className="spotlight-description">{spotlightNote.description}</p>
                </div>
              )}

              {/* Focus Pomodoro Timer */}
              <div className="spotlight-timer-card">
                <div className="spotlight-timer-header">
                  <div className="spotlight-timer-title">
                    <ion-icon name="timer"></ion-icon> Focus Timer
                  </div>
                  <div className="spotlight-timer-presets">
                    <button
                      type="button"
                      className={`timer-preset-btn ${timerPreset === 25 ? 'active' : ''}`}
                      onClick={() => setTimerDuration(25)}
                    >
                      25m
                    </button>
                    <button
                      type="button"
                      className={`timer-preset-btn ${timerPreset === 15 ? 'active' : ''}`}
                      onClick={() => setTimerDuration(15)}
                    >
                      15m
                    </button>
                    <button
                      type="button"
                      className={`timer-preset-btn ${timerPreset === 5 ? 'active' : ''}`}
                      onClick={() => setTimerDuration(5)}
                    >
                      5m
                    </button>
                    <button
                      type="button"
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
                      type="button"
                      className={`timer-action-btn ${isTimerRunning ? 'pause' : 'start'}`}
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                    >
                      <ion-icon name={isTimerRunning ? 'pause' : 'play'}></ion-icon>
                      <span>{isTimerRunning ? 'Pause' : 'Start Focus'}</span>
                    </button>
                    <button
                      type="button"
                      className="timer-reset-btn"
                      onClick={() => setTimerDuration(timerPreset)}
                      title="Reset Timer"
                    >
                      <ion-icon name="refresh"></ion-icon>
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="spotlight-actions">
                <button
                  type="button"
                  className={`spotlight-btn toggle-complete ${spotlightNote.completed ? 'completed' : ''}`}
                  onClick={() => toggleNoteCompletion(spotlightNote)}
                >
                  <ion-icon name="checkmark-circle"></ion-icon>
                  <span>{spotlightNote.completed ? 'Completed' : 'Mark Task Done'}</span>
                </button>

                <button
                  type="button"
                  className="spotlight-btn edit"
                  onClick={() => {
                    closeSpotlight();
                    updateNote(spotlightNote);
                  }}
                >
                  <ion-icon name="create"></ion-icon>
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  className="spotlight-btn delete"
                  onClick={(e) => taskDeleted(e, spotlightNote)}
                >
                  <ion-icon name="trash"></ion-icon>
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Spotlight Footer Navigation */}
            <div className="spotlight-footer">
              <button
                type="button"
                className="spotlight-nav-btn prev"
                onClick={() => goToAdjacentSpotlight(-1)}
                disabled={filteredNotes.length <= 1}
                title="Previous Task (←)"
              >
                <ion-icon name="arrow-back"></ion-icon>
                <span>Previous</span>
              </button>

              <div className="spotlight-keyboard-hints">
                <span><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
                <span><kbd>Esc</kbd> Exit</span>
              </div>

              <button
                type="button"
                className="spotlight-nav-btn next"
                onClick={() => goToAdjacentSpotlight(1)}
                disabled={filteredNotes.length <= 1}
                title="Next Task (→)"
              >
                <span>Next</span>
                <ion-icon name="arrow-forward"></ion-icon>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notescomp;
