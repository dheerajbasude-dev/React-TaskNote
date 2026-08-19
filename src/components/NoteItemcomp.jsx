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

// ============================================================================
// CONTENT CLASSIFIER & PARSER
// ============================================================================

export const analyzeContent = (title, desc) => {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeDesc = typeof desc === 'string' ? desc : '';
  const trimmed = safeDesc.trim();

  if (!trimmed) {
    return {
      type: 'note',
      label: 'Note',
      icon: 'document-text-outline',
      color: '#64748b',
      data: null,
      rawText: '',
    };
  }

  // 1. Subtasks Tracker Check
  const linesOrParts = trimmed.includes('\n')
    ? trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

  const genuineSubtasks = [];
  const statusKeywords = ['pending', 'completed', 'in-progress', 'done', 'todo', 'progress', 'doing', 'finished', '--'];

  for (let i = 0; i < linesOrParts.length; i++) {
    const part = linesOrParts[i];
    const mdMatch = part.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
    if (mdMatch) {
      genuineSubtasks.push({
        id: `subtask-${i}`,
        topic: mdMatch[2].trim(),
        status: mdMatch[1].toLowerCase() === 'x' ? 'completed' : 'pending',
      });
      continue;
    }

    const colonIdx = part.indexOf(':');
    if (colonIdx > 0 && colonIdx < part.length - 1) {
      const topic = part.slice(0, colonIdx).trim();
      const statusRaw = part.slice(colonIdx + 1).trim();
      const sLow = statusRaw.toLowerCase();
      const isLikelyStatus = statusKeywords.some((k) => sLow.includes(k)) || /^\d+--/.test(sLow);
      if (isLikelyStatus && topic.length < 60) {
        genuineSubtasks.push({
          id: `subtask-${i}`,
          topic,
          status: statusRaw,
        });
      }
    }
  }

  if (genuineSubtasks.length >= 2 || (genuineSubtasks.length === 1 && linesOrParts.length === 1 && (genuineSubtasks[0].status.includes('pending') || genuineSubtasks[0].status.includes('completed')))) {
    const totalCount = genuineSubtasks.length;
    const completedCount = genuineSubtasks.filter((item) => {
      const s = item.status.toLowerCase();
      return s.includes('completed') || s.includes('done') || s === 'finished';
    }).length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      type: 'subtasks',
      label: 'Subtasks',
      icon: 'list-circle-outline',
      color: '#6366f1',
      data: {
        items: genuineSubtasks,
        totalCount,
        completedCount,
        percentage,
      },
      rawText: safeDesc,
    };
  }

  // 2. Links & Resources Check
  const bracketMatches = [...trimmed.matchAll(/\[([^\]]+)\](?:\(([^)]+)\))?/g)];
  const urlMatches = trimmed.match(/https?:\/\/[^\s,)]+/gi);
  const isWebsiteCategory =
    safeTitle.toLowerCase().includes('website') ||
    safeTitle.toLowerCase().includes('link') ||
    safeTitle.toLowerCase().includes('resource') ||
    safeTitle.toLowerCase().includes('site');

  if (bracketMatches.length > 0 || urlMatches || isWebsiteCategory) {
    const resources = [];
    if (bracketMatches.length > 0) {
      bracketMatches.forEach((m, idx) => {
        const name = m[1].trim();
        const customUrl = m[2] ? m[2].trim() : null;
        let url = customUrl;
        if (!url) {
          if (name.startsWith('http')) {
            url = name;
          } else if (name.includes('.') && !name.includes(' ')) {
            url = `https://${name}`;
          } else {
            url = `https://www.google.com/search?q=${encodeURIComponent(name)}`;
          }
        }
        resources.push({
          id: `res-${idx}`,
          title: name,
          url,
        });
      });
    } else if (urlMatches) {
      urlMatches.forEach((url, idx) => {
        let domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
        resources.push({
          id: `res-${idx}`,
          title: domain || url,
          url,
        });
      });
    }

    if (resources.length > 0) {
      return {
        type: 'resources',
        label: 'Links & Sites',
        icon: 'link-outline',
        color: '#06b6d4',
        data: {
          items: resources,
          totalCount: resources.length,
        },
        rawText: safeDesc,
      };
    }
  }

  // 3. Documentation / Code Explanation
  const isCode =
    trimmed.includes('```') ||
    trimmed.includes('const ') ||
    trimmed.includes('function ') ||
    trimmed.includes('import ') ||
    trimmed.includes('def ') ||
    trimmed.includes('=>');

  const isDoc =
    trimmed.includes('\n- ') ||
    trimmed.includes('\n* ') ||
    trimmed.includes('\n1. ') ||
    trimmed.includes('##') ||
    trimmed.split('\n').length >= 3;

  if (isCode || isDoc) {
    return {
      type: 'docs',
      label: isCode ? 'Code' : 'Docs',
      icon: isCode ? 'code-slash-outline' : 'reader-outline',
      color: '#8b5cf6',
      data: {
        isCode,
        lineCount: trimmed.split('\n').length,
      },
      rawText: safeDesc,
    };
  }

  return {
    type: 'note',
    label: 'Note',
    icon: 'document-text-outline',
    color: '#64748b',
    data: null,
    rawText: safeDesc,
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
  const analysis = analyzeContent('', currentDesc);
  if (analysis.type !== 'subtasks' || !analysis.data || !analysis.data.items[targetIndex]) {
    return currentDesc;
  }

  const item = analysis.data.items[targetIndex];
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

  analysis.data.items[targetIndex].status = newStatus;
  return analysis.data.items.map((it) => `${it.topic}: ${it.status}`).join(' , ');
};

// ============================================================================
// MAIN COMPACT COMPONENT (SINGLE DEFINITIVE LAYOUT)
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

  // Modal, editing and loading states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState({ title: '', description: '', tag: 'medium' });
  const [editingNote, setEditingNote] = useState(null);
  const [isbtnLoading, setIsbtnLoading] = useState(false);

  // Modal subtask builder state
  const [activeModalTab, setActiveModalTab] = useState('plaintext');
  const [builderSubtasks, setBuilderSubtasks] = useState([]);
  const [newSubtaskTopic, setNewSubtaskTopic] = useState('');
  const [newSubtaskStatus, setNewSubtaskStatus] = useState('pending');

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
    setActiveModalTab('plaintext');
    setBuilderSubtasks([]);
    setNewSubtaskTopic('');
    setNewSubtaskStatus('pending');
  };

  const playRandomDeleteSound = () => {
    playSound(Math.random() < 0.5 ? TaskDeleted1Sound : TaskDeleted2Sound);
  };

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
    if (presetType === 'websites') {
      setNote((prev) => ({
        ...prev,
        title: prev.title || 'WEBSITE: Resources & Useful Sites',
        description: '{ [Free4Talk] , [Speak & improve] , [Speaking Club] , [Speak better every lesson] }',
      }));
      setActiveModalTab('plaintext');
    } else if (presetType === 'interview') {
      const items = [
        { id: `p-1`, topic: 'Interview', status: 'pending' },
        { id: `p-2`, topic: 'Interview-prep', status: 'pending' },
        { id: `p-3`, topic: 'Java', status: 'pending' },
        { id: `p-4`, topic: 'SpringBoot', status: 'completed' },
        { id: `p-5`, topic: 'Microservice-topics', status: 'pending' },
        { id: `p-6`, topic: 'DSA', status: 'pending' },
        { id: `p-7`, topic: 'System-design', status: 'pending' },
        { id: `p-8`, topic: 'Coding', status: 'pending' },
      ];
      setBuilderSubtasks(items);
      syncBuilderToDescription(items);
      setActiveModalTab('structured');
    } else if (presetType === 'docs') {
      setNote((prev) => ({
        ...prev,
        title: prev.title || 'DOCS: Architecture & Key Points',
        description: '## Key Implementation Notes\n- Use React hooks for clean lifecycle management\n- Persist user custom orders in localStorage\n- Fast API endpoints for real-time sync',
      }));
      setActiveModalTab('plaintext');
    } else if (presetType === 'sprint') {
      const items = [
        { id: `p-1`, topic: 'UI/UX Design', status: 'completed' },
        { id: `p-2`, topic: 'Backend API', status: 'in-progress' },
        { id: `p-3`, topic: 'Frontend Integration', status: 'pending' },
        { id: `p-4`, topic: 'Testing & QA', status: 'pending' },
        { id: `p-5`, topic: 'Deployment', status: 'pending' },
      ];
      setBuilderSubtasks(items);
      syncBuilderToDescription(items);
      setActiveModalTab('structured');
    }
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

  // Keyboard shortcuts
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
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      e.preventDefault();
      return;
    }
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
          playSound(EditTaskSound);
          setNote({ title: '', description: '', tag: 'medium' });
          setIsEditing(false);
          setIsbtnLoading(false);
          handleCancelTask();
        });
    } else {
      addNote(note.title, finalDescription, note.tag)
        .then(() => {
          playSound(AddTaskSound);
          setNote({ title: '', description: '', tag: 'medium' });
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

  // SILENT Subtask toggle directly on the card
  const handleCardSubtaskClick = async (e, noteItem, subtaskIndex) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIndex);
    if (updatedDesc !== noteItem.description) {
      await editNote(noteItem._id, noteItem.title, updatedDesc, noteItem.tag);
    }
  };

  // Open resource link safely
  const handleOpenResource = (e, url) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
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

    const analysis = analyzeContent(currentNote.title, currentNote.description);
    if (analysis.type === 'subtasks' && analysis.data) {
      setBuilderSubtasks(analysis.data.items);
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
    const cleanQuery = query.trim();
    if (!cleanQuery) return text;
    const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, index) => {
      if (part.toLowerCase() === cleanQuery.toLowerCase()) {
        return (
          <mark key={index} className="search-highlight-badge">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Render docs text compactly
  const renderDocsContent = (text, query) => {
    if (!text) return null;
    const lines = text.split('\n').filter(Boolean);
    return (
      <div className="compact-docs-box">
        {lines.map((line, idx) => (
          <div key={idx} className="compact-doc-line">
            <span className="doc-bullet">•</span>
            <span>{highlightMatches(line.replace(/^[#\-*0-9.]+\s*/, ''), query)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="sleek-page-wrapper">
      <main className="sleek-app-container" ref={taskNoteContainerRef}>
        {/* Unified Sleek Task Feed */}
        {isLoading ? (
          <div className="sleek-tasks-feed">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="sleek-task-row skeleton-row" key={`skeleton-${index}`}>
                <Skeleton circle height={18} width={18} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={14} width="50%" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="sleek-empty-card">
            <ion-icon name="sparkles-outline"></ion-icon>
            <h3>{searchQuery ? 'No matching tasks' : 'No tasks here yet'}</h3>
            <p>{searchQuery ? `No tasks match "${searchQuery}".` : 'Add your first task or link collection.'}</p>
            <button type="button" onClick={openModal}>
              <ion-icon name="add"></ion-icon>
              <span>Create Task</span>
            </button>
          </div>
        ) : (
          <div className="sleek-tasks-feed">
            {filteredNotes.map((noteItem, index) => {
              const isItemDragging = draggingIndex === index;
              const isItemOver = dragOverIndex === index;
              const analysis = analyzeContent(noteItem.title, noteItem.description);
              const isFirst = index === 0;

              return (
                <article
                  className={`sleek-task-row ${isFirst ? 'is-spotlight-focus' : ''} ${noteItem.completed ? 'is-completed' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
                  data-index={index}
                  key={noteItem._id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    '--row-accent': getPriorityColor(noteItem.tag),
                  }}
                >
                  {/* Top Header Line: Title -> Priority -> Category / Status Pill -> Date & Actions */}
                  <div className="sleek-row-header">
                    <div className="sleek-row-header-left">
                      {/* 1. Title */}
                      <span
                        className={`sleek-task-title ${noteItem.completed ? 'strike' : ''}`}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                      >
                        {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                      </span>

                      {/* 2. Priority Tag */}
                      <span
                        className="sleek-priority-tag"
                        style={{
                          color: getPriorityColor(noteItem.tag),
                          backgroundColor: `${getPriorityColor(noteItem.tag)}12`,
                        }}
                      >
                        {(noteItem.tag || 'medium').slice(0, 3).toUpperCase()}
                      </span>

                      {/* 3. Smart Category / Status Pill */}
                      <button
                        type="button"
                        className={`sleek-status-pill ${noteItem.completed ? 'is-done' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNoteCompletion(noteItem);
                        }}
                        title={noteItem.completed ? 'Click to mark pending' : 'Click to mark completed'}
                        style={{
                          '--pill-color': noteItem.completed ? '#10b981' : analysis.color,
                        }}
                      >
                        <span className="status-pill-icon">
                          <ion-icon name={noteItem.completed ? 'checkmark-circle' : analysis.icon}></ion-icon>
                        </span>
                        <span className="status-pill-label">
                          {noteItem.completed ? 'Done' : analysis.label}
                        </span>
                      </button>
                    </div>

                    <div className="sleek-row-header-right">
                      <div className="sleek-date-badge-wrap">
                        <span className="sleek-date-meta" title={`Created on ${noteItem.date}`}>
                          {noteItem.date}
                        </span>
                        {Boolean(noteItem.updatedDate || noteItem.isEdited) && (
                          <span
                            className="sleek-updated-tag"
                            title={`Last updated: ${noteItem.updatedDate || 'recently'}`}
                          >
                            {noteItem.updatedDate ? noteItem.updatedDate : ''}
                          </span>
                        )}
                      </div>

                      <div className="sleek-action-icons">
                        <button
                          type="button"
                          className={`sleek-icon-btn check ${noteItem.completed ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNoteCompletion(noteItem);
                          }}
                          title={noteItem.completed ? 'Mark pending' : 'Mark done'}
                        >
                          <ion-icon name={noteItem.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}></ion-icon>
                        </button>

                        <button
                          type="button"
                          className="sleek-icon-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNote(noteItem);
                          }}
                          title="Edit"
                        >
                          <ion-icon name="create-outline"></ion-icon>
                        </button>

                        <button
                          type="button"
                          className="sleek-icon-btn delete"
                          onClick={(e) => taskDeleted(e, noteItem)}
                          title="Delete"
                        >
                          <ion-icon name="trash-outline"></ion-icon>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content Section: Cleanly aligned beneath title */}
                  <div
                    className="sleek-row-body"
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                  >
                    {/* TYPE 1: SUBTASKS TRACKER */}
                    {analysis.type === 'subtasks' && analysis.data && (
                      <div className="sleek-subtasks-group">
                        <div className="sleek-mini-progress">
                          <div className="sleek-progress-bar-wrap">
                            <div
                              className="sleek-progress-bar-fill"
                              style={{
                                width: `${analysis.data.percentage}%`,
                                background: analysis.data.percentage === 100 ? '#10b981' : '#6366f1',
                              }}
                            ></div>
                          </div>
                          <span className="sleek-progress-num">
                            {analysis.data.completedCount}/{analysis.data.totalCount} ({analysis.data.percentage}%)
                          </span>
                        </div>

                        <div className="sleek-chips-wrap">
                          {analysis.data.items.map((subItem, sIdx) => {
                            const statusType = getSubtaskStatusType(subItem.status);
                            return (
                              <button
                                key={subItem.id || sIdx}
                                type="button"
                                className={`sleek-subtask-pill status-${statusType}`}
                                onClick={(e) => handleCardSubtaskClick(e, noteItem, sIdx)}
                                title={`Click to cycle status (${subItem.status})`}
                              >
                                <span className="pill-topic">
                                  {searchQuery ? highlightMatches(subItem.topic, searchQuery) : subItem.topic}
                                </span>
                                <span className="pill-status">
                                  {searchQuery ? highlightMatches(subItem.status, searchQuery) : subItem.status}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* TYPE 2: LINKS & SITES */}
                    {analysis.type === 'resources' && analysis.data && (
                      <div className="sleek-resources-wrap">
                        {analysis.data.items.map((res, rIdx) => (
                          <button
                            key={res.id || rIdx}
                            type="button"
                            className="sleek-resource-pill"
                            onClick={(e) => handleOpenResource(e, res.url)}
                            title={`Open ${res.title}`}
                          >
                            <ion-icon name="open-outline"></ion-icon>
                            <span>{searchQuery ? highlightMatches(res.title, searchQuery) : res.title}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* TYPE 3: DOCS & CODE */}
                    {analysis.type === 'docs' && renderDocsContent(noteItem.description, searchQuery)}

                    {/* TYPE 4: PLAIN NOTE */}
                    {analysis.type === 'note' && (
                      <p className="sleek-plain-text">
                        {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Sticky Floating Center Add Task Button (Only + Icon) */}
      <button
        type="button"
        className="sleek-floating-add-btn"
        onClick={openModal}
        title="Add Task (Press '+' or 'N')"
        aria-label="Add Task"
      >
        <ion-icon name="add"></ion-icon>
      </button>

      {/* Scroll to Top */}
      {showScrollButton && (
        <button type="button" className="sleek-scroll-top" onClick={scrollToTop} title="Scroll Top">
          <ArrowCircleUpSharpIcon />
        </button>
      )}

      {/* =================================================================== */}
      {/* SLEEK ADD / EDIT MODAL                                              */}
      {/* =================================================================== */}
      {showModal && (
        <div className="sleek-modal-overlay" onClick={handleCancelTask}>
          <div className="sleek-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sleek-modal-header">
              <div className="modal-title-box">
                <ion-icon name={isEditing ? 'create-outline' : 'sparkles-outline'}></ion-icon>
                <h3>{isEditing ? 'Edit Task' : 'New Task'}</h3>
              </div>
              <button type="button" className="modal-close-ico" onClick={handleCancelTask}>
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            <form className="sleek-modal-form" onSubmit={handleAddTask}>
              {/* Title & Priority Row */}
              <div className="modal-row-title">
                <input
                  id="task-title"
                  name="title"
                  type="text"
                  className="sleek-input-title"
                  value={note.title}
                  onChange={onChange}
                  minLength={3}
                  placeholder="Task title (e.g. WEBSITE: English practice, Sprint Beta)..."
                  required
                  autoFocus
                />

                <div className="sleek-modal-priority">
                  <button
                    type="button"
                    className={`priority-pill high ${note.tag === 'high' ? 'active' : ''}`}
                    onClick={() => setNote({ ...note, tag: 'high' })}
                  >
                    High
                  </button>
                  <button
                    type="button"
                    className={`priority-pill med ${note.tag === 'medium' ? 'active' : ''}`}
                    onClick={() => setNote({ ...note, tag: 'medium' })}
                  >
                    Med
                  </button>
                  <button
                    type="button"
                    className={`priority-pill low ${note.tag === 'low' ? 'active' : ''}`}
                    onClick={() => setNote({ ...note, tag: 'low' })}
                  >
                    Low
                  </button>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="sleek-modal-tabs">
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
                  📝 Text / Links / Docs
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeModalTab === 'structured' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveModalTab('structured');
                    if (builderSubtasks.length === 0 && note.description.trim()) {
                      const analysis = analyzeContent('', note.description);
                      if (analysis.type === 'subtasks' && analysis.data) {
                        setBuilderSubtasks(analysis.data.items);
                      }
                    }
                  }}
                >
                  📋 Subtask Builder ({builderSubtasks.length})
                </button>
              </div>

              {/* TAB 1: UNIVERSAL TEXT */}
              {activeModalTab === 'plaintext' && (
                <div className="modal-tab-body">
                  <div className="sleek-presets-bar">
                    <span>⚡ Presets:</span>
                    <button type="button" onClick={() => handleApplyPresetTemplate('websites')}>🔗 Websites List</button>
                    <button type="button" onClick={() => handleApplyPresetTemplate('interview')}>💼 Interview Prep</button>
                    <button type="button" onClick={() => handleApplyPresetTemplate('docs')}>📄 Docs / Notes</button>
                    <button type="button" onClick={() => handleApplyPresetTemplate('sprint')}>🚀 Dev Sprint</button>
                  </div>

                  <textarea
                    id="task-desc"
                    name="description"
                    className="sleek-textarea"
                    value={note.description}
                    rows={4}
                    onChange={onChange}
                    minLength={3}
                    placeholder="Enter plain text, bracketed sites { [Free4Talk] , [Speak & improve] }, docs, or subtasks..."
                    required
                  ></textarea>
                </div>
              )}

              {/* TAB 2: STRUCTURED BUILDER */}
              {activeModalTab === 'structured' && (
                <div className="modal-tab-body">
                  <div className="builder-input-row">
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

                  <div className="builder-list-scroll">
                    {builderSubtasks.length === 0 ? (
                      <div className="builder-empty">Type a subtask topic above or use the Presets!</div>
                    ) : (
                      builderSubtasks.map((item, idx) => {
                        const statusType = getSubtaskStatusType(item.status);
                        return (
                          <div className="builder-item-row" key={item.id || idx}>
                            <span className="idx-num">{idx + 1}.</span>
                            <input
                              type="text"
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
                              className={`status-btn status-${statusType}`}
                              onClick={() => handleCycleBuilderStatus(idx)}
                            >
                              {statusType === 'completed' && 'Completed'}
                              {statusType === 'in-progress' && 'In Progress'}
                              {statusType === 'pending' && 'Pending'}
                            </button>
                            <button
                              type="button"
                              className="trash-btn"
                              onClick={() => handleRemoveBuilderSubtask(idx)}
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

              {/* Modal Footer */}
              <div className="sleek-modal-footer">
                <button
                  type="button"
                  className="sleek-btn-cancel"
                  onClick={handleCancelTask}
                  disabled={isbtnLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sleek-btn-submit"
                  disabled={isbtnLoading || note.title.length < 3}
                >
                  {isbtnLoading ? (
                    <DotPulse size={18} color="#ffffff" />
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
