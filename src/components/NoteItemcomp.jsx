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
import Skeleton from 'react-loading-skeleton';
import './Skeleton.css';
import ArrowCircleUpSharpIcon from '@mui/icons-material/ArrowCircleUpSharp';

// ============================================================================
// STRUCTURED SUBTASKS UTILITIES
// ============================================================================

export const parseDescription = (desc) => {
  if (!desc || typeof desc !== 'string') {
    return { isStructured: false, items: [], rawText: '', totalCount: 0, completedCount: 0, inProgressCount: 0, percentage: 0 };
  }

  const trimmed = desc.trim();
  if (!trimmed) {
    return { isStructured: false, items: [], rawText: '', totalCount: 0, completedCount: 0, inProgressCount: 0, percentage: 0 };
  }

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
// MAIN COMPACT COMPONENT
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

  // Spotlight Focus Mode State
  const [spotlightNote, setSpotlightNote] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPreset, setTimerPreset] = useState(25);

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
        { id: `p-1`, topic: 'UI Design', status: 'completed' },
        { id: `p-2`, topic: 'Backend API', status: 'in-progress' },
        { id: `p-3`, topic: 'Frontend', status: 'pending' },
        { id: `p-4`, topic: 'Unit Tests', status: 'pending' },
        { id: `p-5`, topic: 'Deployment', status: 'pending' },
      ];
    } else if (presetType === 'study') {
      items = [
        { id: `p-1`, topic: 'Theory', status: 'completed' },
        { id: `p-2`, topic: 'Coding Labs', status: 'in-progress' },
        { id: `p-3`, topic: 'Exercises', status: 'pending' },
        { id: `p-4`, topic: 'Revision', status: 'pending' },
      ];
    } else if (presetType === 'daily') {
      items = [
        { id: `p-1`, topic: 'Standup', status: 'completed' },
        { id: `p-2`, topic: 'Focus Task 1', status: 'in-progress' },
        { id: `p-3`, topic: 'Code Review', status: 'pending' },
        { id: `p-4`, topic: 'Wrap-up', status: 'pending' },
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
            return prev + 1;
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

  // SILENT Subtask toggle directly from the card (NO LOUD EDIT TONE)
  const handleCardSubtaskClick = async (e, noteItem, subtaskIndex) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIndex);
    if (updatedDesc !== noteItem.description) {
      // Intentionally silent for seamless fast tapping
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

  const toggleCardExpansion = (e, noteId) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  if (searchQuery === '/commits') {
    navigate('/commits');
    setSearchQuery('');
  }

  const currentSpotlightIndex = spotlightNote
    ? filteredNotes.findIndex((n) => n._id === spotlightNote._id)
    : -1;

  const currentSpotlightParsed = useMemo(() => {
    return spotlightNote ? parseDescription(spotlightNote.description) : null;
  }, [spotlightNote]);

  return (
    <div className="compact-page-wrapper">
      <main className="compact-app-container" ref={taskNoteContainerRef}>
        {/* Compact Dashboard Control Bar */}
        <div className="compact-dashboard-bar">
          <div className="compact-heading-row">
            <h1 className="compact-page-title">
              {selectedPriority === 'All' ? 'Tasks' : `${selectedPriority} Priority`}
            </h1>
            <span className="compact-count-badge">
              {filteredNotes.length}
            </span>
          </div>

          <div className="compact-bar-actions">
            {/* View Switcher: Grid vs List */}
            <div className="compact-view-switcher">
              <button
                type="button"
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => handleToggleViewMode('grid')}
                title="Compact Grid View"
              >
                <ion-icon name="grid-outline"></ion-icon>
              </button>
              <button
                type="button"
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => handleToggleViewMode('list')}
                title="Compact List View"
              >
                <ion-icon name="list-outline"></ion-icon>
              </button>
            </div>

            {/* ONLY ONE CLEAN ADD TASK BUTTON */}
            <button
              type="button"
              className="compact-primary-add-btn"
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
          <div className="compact-tasks-container view-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="compact-card skeleton-card" key={`skeleton-${index}`}>
                <div className="compact-card-header">
                  <Skeleton circle height={18} width={18} />
                  <Skeleton height={16} width="60%" />
                </div>
                <div className="compact-card-body">
                  <Skeleton count={2} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="compact-empty-state">
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
          <div className={`compact-tasks-container view-${viewMode}`}>
            {filteredNotes.map((noteItem, index) => {
              const isItemDragging = draggingIndex === index;
              const isItemOver = dragOverIndex === index;
              const parsed = parseDescription(noteItem.description);
              const isExpanded = Boolean(expandedCards[noteItem._id]);
              const visibleItems = isExpanded ? parsed.items : parsed.items.slice(0, 5);
              const hasMoreItems = parsed.items.length > 5;

              return (
                <article
                  className={`compact-card ${noteItem.completed ? 'is-completed' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
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
                  {/* Left priority accent indicator */}
                  <div className="compact-left-accent"></div>

                  <div className="compact-card-main">
                    {/* Header Row */}
                    <div className="compact-card-header">
                      <div className="compact-title-group">
                        <span
                          className="compact-priority-tag"
                          style={{
                            color: getPriorityColor(noteItem.tag),
                            backgroundColor: `${getPriorityColor(noteItem.tag)}15`,
                          }}
                        >
                          {(noteItem.tag || 'medium').slice(0, 3).toUpperCase()}
                        </span>
                        <h2 className={`compact-title ${noteItem.completed ? 'strike' : ''}`}>
                          {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                        </h2>
                      </div>

                      {/* Action buttons */}
                      <div className="compact-actions">
                        <button
                          type="button"
                          className="compact-btn spotlight"
                          title="Focus Mode"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSpotlight(noteItem);
                          }}
                        >
                          <ion-icon name="scan-outline"></ion-icon>
                        </button>

                        <button
                          type="button"
                          className="compact-btn edit"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNote(noteItem);
                          }}
                        >
                          <ion-icon name="create-outline"></ion-icon>
                        </button>

                        <button
                          type="button"
                          className={`compact-btn complete ${noteItem.completed ? 'active' : ''}`}
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
                          className="compact-btn delete"
                          title="Delete"
                          onClick={(e) => taskDeleted(e, noteItem)}
                        >
                          <ion-icon name="trash-outline"></ion-icon>
                        </button>
                      </div>
                    </div>

                    {/* Body: Structured Subtasks Chips or Plain Text */}
                    <div className="compact-card-body">
                      {parsed.isStructured ? (
                        <div className="compact-subtasks-wrapper">
                          {/* Mini progress line */}
                          <div className="compact-progress-row">
                            <div className="compact-progress-track">
                              <div
                                className="compact-progress-bar"
                                style={{
                                  width: `${parsed.percentage}%`,
                                  background: parsed.percentage === 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #ec4899)',
                                }}
                              ></div>
                            </div>
                            <span className="compact-progress-text">
                              {parsed.completedCount}/{parsed.totalCount} ({parsed.percentage}%)
                            </span>
                          </div>

                          {/* Subtask Chips */}
                          <div className="compact-chips-grid">
                            {visibleItems.map((subItem, sIdx) => {
                              const statusType = getSubtaskStatusType(subItem.status);
                              return (
                                <button
                                  key={subItem.id || sIdx}
                                  type="button"
                                  className={`compact-subtask-chip status-${statusType}`}
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
                              className="compact-expand-btn"
                              onClick={(e) => toggleCardExpansion(e, noteItem._id)}
                            >
                              <span>{isExpanded ? 'Show less' : `+${parsed.items.length - 5} more`}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="compact-plain-desc">
                          {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="compact-card-footer">
                      <div className="compact-footer-meta">
                        <span className="compact-date" title={`Created ${noteItem.date}`}>
                          {noteItem.date}
                        </span>
                        {Boolean(noteItem.updatedDate && (noteItem.isEdited || noteItem.updatedDate !== noteItem.date)) && (
                          <span className="compact-edited-badge" title={`Edited ${noteItem.updatedDate}`}>
                            • edited
                          </span>
                        )}
                      </div>
                      <span className="compact-idx">#{index + 1}</span>
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
        <button type="button" className="compact-scroll-top" onClick={scrollToTop} title="Scroll Top">
          <ArrowCircleUpSharpIcon />
        </button>
      )}

      {/* =================================================================== */}
      {/* COMPACT ADD / EDIT MODAL                                            */}
      {/* =================================================================== */}
      {showModal && (
        <div className="compact-modal-overlay" onClick={handleCancelTask}>
          <div className="compact-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="compact-modal-header">
              <div className="modal-title-wrap">
                <ion-icon name={isEditing ? 'create-outline' : 'add-circle-outline'}></ion-icon>
                <h3>{isEditing ? 'Edit Task' : 'New Task'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={handleCancelTask}>
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            <form className="compact-modal-form" onSubmit={handleAddTask}>
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
                  placeholder="Task title (e.g. Job Prep, Sprint Beta)..."
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
                      <span className="templates-label">Presets:</span>
                      <button type="button" onClick={() => handleApplyPresetTemplate('interview')}>💼 Interview Prep</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('sprint')}>🚀 Sprint</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('study')}>📚 Study</button>
                      <button type="button" onClick={() => handleApplyPresetTemplate('daily')}>✅ Daily</button>
                    </div>

                    {/* Quick Add Row */}
                    <div className="modal-quick-add-row">
                      <input
                        type="text"
                        placeholder="Add subtask (e.g. Java, System Design) & press Enter..."
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
                          Type a subtask topic above or click a preset template!
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
                      rows={3}
                      onChange={onChange}
                      minLength={3}
                      placeholder="Notes or description..."
                      required
                    ></textarea>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="compact-modal-footer">
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
                    <span>{isEditing ? 'Save' : 'Create Task'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* COMPACT SPOTLIGHT FOCUS WORKSPACE                                   */}
      {/* =================================================================== */}
      {spotlightNote && (
        <div className="spotlight-overlay" onClick={closeSpotlight}>
          <div className="spotlight-container" onClick={(e) => e.stopPropagation()}>
            <div className="spotlight-header">
              <div className="spotlight-badge-container">
                <span
                  className="spotlight-priority-badge"
                  style={{
                    borderColor: getPriorityColor(spotlightNote.tag),
                    color: getPriorityColor(spotlightNote.tag),
                  }}
                >
                  {(spotlightNote.tag || 'medium').toUpperCase()} PRIORITY
                </span>
                <span className="spotlight-counter">
                  Task {currentSpotlightIndex + 1} of {filteredNotes.length}
                </span>
              </div>
              <button className="spotlight-close-btn" onClick={closeSpotlight} title="Close (Esc)">
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            <div className="spotlight-body">
              <h1 className={`spotlight-title ${spotlightNote.completed ? 'is-completed' : ''}`}>
                {spotlightNote.title}
              </h1>

              {currentSpotlightParsed && currentSpotlightParsed.isStructured ? (
                <div className="spotlight-subtasks-box">
                  <div className="spotlight-subtasks-header">
                    <span>Subtasks ({currentSpotlightParsed.completedCount}/{currentSpotlightParsed.totalCount})</span>
                    <span>{currentSpotlightParsed.percentage}%</span>
                  </div>
                  <div className="spotlight-checklist">
                    {currentSpotlightParsed.items.map((item, idx) => {
                      const statusType = getSubtaskStatusType(item.status);
                      return (
                        <div
                          key={idx}
                          className={`spotlight-check-item status-${statusType}`}
                          onClick={(e) => handleCardSubtaskClick(e, spotlightNote, idx)}
                        >
                          <ion-icon
                            name={
                              statusType === 'completed'
                                ? 'checkmark-circle'
                                : statusType === 'in-progress'
                                ? 'flash'
                                : 'ellipse-outline'
                            }
                          ></ion-icon>
                          <span className="spotlight-check-topic">{item.topic}</span>
                          <span className="spotlight-check-status">{item.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="spotlight-description">{spotlightNote.description}</p>
              )}

              {/* Timer */}
              <div className="spotlight-timer-card">
                <div className="spotlight-timer-header">
                  <span><ion-icon name="timer"></ion-icon> Focus Timer</span>
                  <div className="spotlight-timer-presets">
                    <button className={timerPreset === 25 ? 'active' : ''} onClick={() => setTimerDuration(25)}>25m</button>
                    <button className={timerPreset === 15 ? 'active' : ''} onClick={() => setTimerDuration(15)}>15m</button>
                    <button className={timerPreset === 5 ? 'active' : ''} onClick={() => setTimerDuration(5)}>5m</button>
                    <button className={timerPreset === 0 ? 'active' : ''} onClick={() => setTimerDuration(0)}>Stopwatch</button>
                  </div>
                </div>
                <div className="spotlight-timer-display-row">
                  <div className="spotlight-timer-digits">{formatTimer(timerSeconds)}</div>
                  <button
                    className={`timer-action-btn ${isTimerRunning ? 'pause' : 'start'}`}
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                  >
                    {isTimerRunning ? 'Pause' : 'Focus'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="spotlight-actions">
                <button
                  className={`spotlight-btn toggle-complete ${spotlightNote.completed ? 'completed' : ''}`}
                  onClick={() => toggleNoteCompletion(spotlightNote)}
                >
                  <ion-icon name="checkmark-circle"></ion-icon>
                  <span>{spotlightNote.completed ? 'Completed' : 'Mark Done'}</span>
                </button>
                <button
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
                  className="spotlight-btn delete"
                  onClick={(e) => taskDeleted(e, spotlightNote)}
                >
                  <ion-icon name="trash"></ion-icon>
                  <span>Delete</span>
                </button>
              </div>
            </div>

            <div className="spotlight-footer">
              <button
                className="spotlight-nav-btn prev"
                onClick={() => goToAdjacentSpotlight(-1)}
                disabled={filteredNotes.length <= 1}
              >
                <ion-icon name="arrow-back"></ion-icon>
                <span>Prev</span>
              </button>
              <span className="spotlight-hint"><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
              <button
                className="spotlight-nav-btn next"
                onClick={() => goToAdjacentSpotlight(1)}
                disabled={filteredNotes.length <= 1}
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
