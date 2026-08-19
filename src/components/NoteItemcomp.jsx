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
// CONTENT CLASSIFIER & PARSER
// ============================================================================

export const analyzeContent = (title, desc) => {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeDesc = typeof desc === 'string' ? desc : '';
  const trimmed = safeDesc.trim();

  if (!trimmed) {
    return { type: 'note', label: 'Note', icon: 'document-text-outline', color: '#64748b', data: null, rawText: '' };
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
        genuineSubtasks.push({ id: `subtask-${i}`, topic, status: statusRaw });
      }
    }
  }

  if (genuineSubtasks.length >= 2 || (genuineSubtasks.length === 1 && linesOrParts.length === 1)) {
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
      data: { items: genuineSubtasks, totalCount, completedCount, percentage },
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
          if (name.startsWith('http')) url = name;
          else if (name.includes('.') && !name.includes(' ')) url = `https://${name}`;
          else url = `https://www.google.com/search?q=${encodeURIComponent(name)}`;
        }
        resources.push({ id: `res-${idx}`, title: name, url });
      });
    } else if (urlMatches) {
      urlMatches.forEach((url, idx) => {
        const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
        resources.push({ id: `res-${idx}`, title: domain || url, url });
      });
    }
    if (resources.length > 0) {
      return {
        type: 'resources',
        label: 'Links',
        icon: 'link-outline',
        color: '#0891b2',
        data: { items: resources, totalCount: resources.length },
        rawText: safeDesc,
      };
    }
  }

  // 3. Documentation / Code
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
      color: '#7c3aed',
      data: { isCode, lineCount: trimmed.split('\n').length },
      rawText: safeDesc,
    };
  }

  return { type: 'note', label: 'Note', icon: 'document-text-outline', color: '#64748b', data: null, rawText: safeDesc };
};

export const getSubtaskStatusType = (statusStr) => {
  if (!statusStr) return 'pending';
  const s = statusStr.toLowerCase();
  if (s.includes('completed') || s.includes('done') || s === 'finished' || s === 'complete') return 'completed';
  if (s.includes('progress') || s.includes('doing') || s.includes('active') || s.includes('--')) return 'in-progress';
  return 'pending';
};

export const toggleSubtaskItemStatus = (currentDesc, targetIndex) => {
  const analysis = analyzeContent('', currentDesc);
  if (analysis.type !== 'subtasks' || !analysis.data || !analysis.data.items[targetIndex]) return currentDesc;

  const item = analysis.data.items[targetIndex];
  const currentStatusType = getSubtaskStatusType(item.status);

  let newStatus = '';
  if (currentStatusType === 'pending') newStatus = 'in-progress';
  else if (currentStatusType === 'in-progress') newStatus = 'completed';
  else newStatus = 'pending';

  analysis.data.items[targetIndex].status = newStatus;
  return analysis.data.items.map((it) => `${it.topic}: ${it.status}`).join(' , ');
};

// ============================================================================
// RELATIVE DATE FORMATTER
// ============================================================================

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Notescomp = ({ searchQuery, setSearchQuery, selectedPriority }) => {
  const playSound = useCallback((soundFile) => {
    try { new Audio(soundFile).play().catch(() => {}); } catch (e) {}
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

  // Modal tabs & builder
  const [activeModalTab, setActiveModalTab] = useState('plaintext');
  const [builderSubtasks, setBuilderSubtasks] = useState([]);
  const [newSubtaskTopic, setNewSubtaskTopic] = useState('');
  const [newSubtaskStatus, setNewSubtaskStatus] = useState('pending');

  // Drag & Drop
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => setShowScrollButton(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Fetch initial notes
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
    const newItem = { id: `builder-${Date.now()}-${Math.random()}`, topic: newSubtaskTopic.trim(), status: newSubtaskStatus || 'pending' };
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
    const cur = getSubtaskStatusType(updated[index].status);
    updated[index].status = cur === 'pending' ? 'in-progress' : cur === 'in-progress' ? 'completed' : 'pending';
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
        { id: 'p-1', topic: 'Interview', status: 'pending' },
        { id: 'p-2', topic: 'Interview-prep', status: 'pending' },
        { id: 'p-3', topic: 'Java', status: 'pending' },
        { id: 'p-4', topic: 'SpringBoot', status: 'completed' },
        { id: 'p-5', topic: 'Microservice-topics', status: 'pending' },
        { id: 'p-6', topic: 'DSA', status: 'pending' },
        { id: 'p-7', topic: 'System-design', status: 'pending' },
        { id: 'p-8', topic: 'Coding', status: 'pending' },
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
        { id: 'p-1', topic: 'UI/UX Design', status: 'completed' },
        { id: 'p-2', topic: 'Backend API', status: 'in-progress' },
        { id: 'p-3', topic: 'Frontend Integration', status: 'pending' },
        { id: 'p-4', topic: 'Testing & QA', status: 'pending' },
        { id: 'p-5', topic: 'Deployment', status: 'pending' },
      ];
      setBuilderSubtasks(items);
      syncBuilderToDescription(items);
      setActiveModalTab('structured');
    }
  };

  // Filter & sort notes
  useEffect(() => {
    const customOrderStr = localStorage.getItem('tasknote_custom_order');
    let orderMap = {};
    if (customOrderStr) {
      try {
        const orderArr = JSON.parse(customOrderStr);
        orderArr.forEach((id, idx) => { orderMap[id] = idx; });
      } catch (e) {}
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
      if (evt.key === 'Escape' && showModal) handleCancelTask();
      if ((evt.key === '+' || evt.key === 'n' || evt.key === 'N') && !showModal && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        evt.preventDefault();
        openModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, handleCancelTask]);

  // Drag & Drop
  const handleDragStart = (e, index) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
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

  const handleDragEnd = () => { setDraggingIndex(null); setDragOverIndex(null); };

  // Add / Edit submit
  const handleAddTask = async (e) => {
    e.preventDefault();
    setIsbtnLoading(true);
    let finalDescription = note.description.trim();
    if (activeModalTab === 'structured' && builderSubtasks.length > 0) {
      finalDescription = builderSubtasks.map((item) => `${item.topic}: ${item.status}`).join(' , ');
    }
    if (isEditing && editingNote) {
      editNote(editingNote._id, note.title, finalDescription, note.tag).then(() => {
        setNote({ title: '', description: '', tag: 'medium' });
        setIsEditing(false);
        setIsbtnLoading(false);
        handleCancelTask();
      });
    } else {
      addNote(note.title, finalDescription, note.tag).then(() => {
        setNote({ title: '', description: '', tag: 'medium' });
        playSound(AddTaskSound);
        setIsbtnLoading(false);
        handleCancelTask();
      });
    }
  };

  const onChange = (e) => setNote({ ...note, [e.target.name]: e.target.value });

  const getPriorityColor = (tag) => {
    if (tag === 'low') return '#059669';
    if (tag === 'medium') return '#7c3aed';
    if (tag === 'high') return '#e11d48';
    return '#7c3aed';
  };

  const getPriorityLabel = (tag) => {
    if (tag === 'high') return 'HIGH';
    if (tag === 'medium') return 'MED';
    if (tag === 'low') return 'LOW';
    return 'MED';
  };

  const getPriorityClass = (tag) => {
    if (tag === 'high') return 'prio-high';
    if (tag === 'medium') return 'prio-med';
    if (tag === 'low') return 'prio-low';
    return 'prio-med';
  };

  const toggleNoteCompletion = async (noteItem) => {
    const completed = !noteItem.completed;
    noteItem.completed = completed;
    playSound(completed ? TaskCompletedSound : UnCompletedTaskSound);
    await updateNoteCompletedStatus(noteItem._id, completed);
  };

  const handleCardSubtaskClick = async (e, noteItem, subtaskIndex) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIndex);
    if (updatedDesc !== noteItem.description) {
      await editNote(noteItem._id, noteItem.title, updatedDesc, noteItem.tag);
    }
  };

  const handleOpenResource = (e, url) => {
    e.stopPropagation();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const updateNote = (currentNote) => {
    setIsEditing(true);
    setShowModal(true);
    setEditingNote(currentNote);
    setNote({ title: currentNote.title, description: currentNote.description, tag: currentNote.tag || 'medium' });
    const analysis = analyzeContent(currentNote.title, currentNote.description);
    if (analysis.type === 'subtasks' && analysis.data) {
      setBuilderSubtasks(analysis.data.items);
      setActiveModalTab('structured');
    } else {
      setBuilderSubtasks([]);
      setActiveModalTab('plaintext');
    }
  };

  const taskDeleted = (event, noteItem) => {
    event.stopPropagation();
    if (window.confirm(`Delete "${noteItem.title}"?`)) {
      playSound(Math.random() < 0.5 ? TaskDeleted1Sound : TaskDeleted2Sound);
      deleteNote(noteItem._id);
    }
  };

  // Highlight search matches
  const highlightMatches = (text, query) => {
    if (!query || typeof text !== 'string') return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? <span key={index} className="search-highlight">{part}</span> : part
    );
  };

  // Render docs text
  const renderDocsContent = (text, query) => {
    if (!text) return null;
    const lines = text.split('\n').filter(Boolean);
    return (
      <div className="docs-block">
        {lines.map((line, idx) => (
          <div key={idx} className="doc-line">
            <span className="doc-bullet">•</span>
            <span>{highlightMatches(line.replace(/^[#\-*0-9.]+\s*/, ''), query)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Subtask chip class
  const getChipClass = (statusType) => {
    if (statusType === 'completed') return 'subtask-chip chip-done';
    if (statusType === 'in-progress') return 'subtask-chip chip-prog';
    return 'subtask-chip chip-pend';
  };

  // Builder status display
  const getBuilderStatusClass = (statusType) => {
    if (statusType === 'completed') return 'builder-status-btn bstatus-done';
    if (statusType === 'in-progress') return 'builder-status-btn bstatus-prog';
    return 'builder-status-btn bstatus-pend';
  };

  const getBuilderStatusLabel = (statusType) => {
    if (statusType === 'completed') return '✓ Done';
    if (statusType === 'in-progress') return '⚡ Active';
    return '⏳ Pending';
  };

  return (
    <div className="page-wrapper">
      <main className="page-container" ref={taskNoteContainerRef}>

        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">
            {selectedPriority === 'All' ? 'My Tasks' : `${selectedPriority} Priority`}
          </h1>
          {!isLoading && (
            <span className="page-count">
              {filteredNotes.length} {filteredNotes.length === 1 ? 'task' : 'tasks'}
            </span>
          )}
        </div>

        {/* Task Feed */}
        {isLoading ? (
          <div className="task-feed">
            {Array.from({ length: 5 }, (_, i) => (
              <div className="skeleton-card" key={`sk-${i}`}>
                <Skeleton circle height={20} width={20} />
                <div>
                  <Skeleton height={14} width="55%" />
                  <Skeleton height={11} width="30%" style={{ marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ion-icon name="sparkles-outline"></ion-icon>
            </div>
            <h2 className="empty-title">
              {searchQuery ? 'No matching tasks' : 'No tasks yet'}
            </h2>
            <p className="empty-subtitle">
              {searchQuery
                ? `No tasks match "${searchQuery}". Try a different search.`
                : 'Create your first task, link collection, or note below.'}
            </p>
            <button type="button" className="empty-cta" onClick={openModal}>
              <ion-icon name="add"></ion-icon>
              <span>Create Task</span>
            </button>
          </div>
        ) : (
          <div className="task-feed">
            {filteredNotes.map((noteItem, index) => {
              const isDragging = draggingIndex === index;
              const isOver = dragOverIndex === index;
              const analysis = analyzeContent(noteItem.title, noteItem.description);

              return (
                <article
                  key={noteItem._id}
                  className={`task-card ${noteItem.completed ? 'card-completed' : ''} ${isDragging ? 'card-dragging' : ''} ${isOver ? 'card-drag-over' : ''}`}
                  data-index={index}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{ '--card-accent': getPriorityColor(noteItem.tag) }}
                >
                  {/* Col 1 — Checkbox */}
                  <div className="task-checkbox-wrap">
                    <button
                      type="button"
                      className={`task-check ${noteItem.completed ? 'is-done' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleNoteCompletion(noteItem); }}
                      title={noteItem.completed ? 'Mark pending' : 'Mark complete'}
                    >
                      <ion-icon name={noteItem.completed ? 'checkmark' : 'ellipse-outline'}></ion-icon>
                    </button>
                  </div>

                  {/* Col 2 — Body */}
                  <div className="task-body">
                    {/* Title */}
                    <span className={`task-title ${noteItem.completed ? 'is-struck' : ''}`}>
                      {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                    </span>

                    {/* Meta tags (priority + category) — below title */}
                    <div className="task-meta-row">
                      <span className={`task-priority-tag ${getPriorityClass(noteItem.tag)}`}>
                        {getPriorityLabel(noteItem.tag)}
                      </span>
                      <span
                        className="task-cat-tag"
                        style={{ color: analysis.color, background: `${analysis.color}14`, borderColor: `${analysis.color}30` }}
                      >
                        <ion-icon name={analysis.icon}></ion-icon>
                        {analysis.label}
                      </span>
                    </div>

                    {/* Content: dynamic type rendering */}
                    <div className="task-content-area">

                      {/* SUBTASKS */}
                      {analysis.type === 'subtasks' && analysis.data && (
                        <div className="subtasks-block">
                          <div className="subtasks-progress">
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${analysis.data.percentage}%`,
                                  background: analysis.data.percentage === 100 ? '#10b981' : '#6366f1',
                                }}
                              />
                            </div>
                            <span className="progress-label">
                              {analysis.data.completedCount}/{analysis.data.totalCount} done
                            </span>
                          </div>
                          <div className="subtasks-chips">
                            {analysis.data.items.map((subItem, sIdx) => {
                              const statusType = getSubtaskStatusType(subItem.status);
                              return (
                                <button
                                  key={subItem.id || sIdx}
                                  type="button"
                                  className={getChipClass(statusType)}
                                  onClick={(e) => handleCardSubtaskClick(e, noteItem, sIdx)}
                                  title={`Click to cycle: ${subItem.status}`}
                                >
                                  <span className="chip-dot"></span>
                                  <span>{searchQuery ? highlightMatches(subItem.topic, searchQuery) : subItem.topic}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* LINKS */}
                      {analysis.type === 'resources' && analysis.data && (
                        <div className="resources-block">
                          {analysis.data.items.map((res, rIdx) => (
                            <button
                              key={res.id || rIdx}
                              type="button"
                              className="resource-pill"
                              onClick={(e) => handleOpenResource(e, res.url)}
                              title={`Open ${res.title}`}
                            >
                              <ion-icon name="open-outline"></ion-icon>
                              {searchQuery ? highlightMatches(res.title, searchQuery) : res.title}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* DOCS */}
                      {analysis.type === 'docs' && renderDocsContent(noteItem.description, searchQuery)}

                      {/* PLAIN NOTE */}
                      {analysis.type === 'note' && noteItem.description && (
                        <p className="task-note-text">
                          {searchQuery ? highlightMatches(noteItem.description, searchQuery) : noteItem.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Col 3 — Actions */}
                  <div className="task-actions">
                    <span className="task-date">{formatRelativeDate(noteItem.date)}</span>
                    <div className="task-btns">
                      <button
                        type="button"
                        className="task-btn btn-edit"
                        onClick={(e) => { e.stopPropagation(); updateNote(noteItem); }}
                        title="Edit task"
                      >
                        <ion-icon name="create-outline"></ion-icon>
                      </button>
                      <button
                        type="button"
                        className="task-btn btn-delete"
                        onClick={(e) => taskDeleted(e, noteItem)}
                        title="Delete task"
                      >
                        <ion-icon name="trash-outline"></ion-icon>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        type="button"
        className="fab-add"
        onClick={openModal}
        title="Add Task (N or +)"
      >
        <ion-icon name="add"></ion-icon>
        <span>Add Task</span>
        <span className="fab-kbd">N</span>
      </button>

      {/* Scroll to top */}
      {showScrollButton && (
        <button type="button" className="scroll-top-btn" onClick={scrollToTop} title="Scroll to top">
          <ArrowCircleUpSharpIcon fontSize="small" />
        </button>
      )}

      {/* ================================================================= */}
      {/* MODAL                                                              */}
      {/* ================================================================= */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancelTask}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-head">
              <div className="modal-head-left">
                <div className="modal-head-icon">
                  <ion-icon name={isEditing ? 'create-outline' : 'sparkles-outline'}></ion-icon>
                </div>
                <span className="modal-head-title">{isEditing ? 'Edit Task' : 'New Task'}</span>
              </div>
              <button type="button" className="modal-close" onClick={handleCancelTask}>
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            {/* Body */}
            <form className="modal-body" onSubmit={handleAddTask}>

              {/* Title */}
              <div>
                <label className="field-label" htmlFor="task-title">Title</label>
                <input
                  id="task-title"
                  name="title"
                  type="text"
                  className="field-title-input"
                  value={note.title}
                  onChange={onChange}
                  minLength={3}
                  placeholder="e.g. WEBSITE: English practice, Sprint v2..."
                  required
                  autoFocus
                />
              </div>

              {/* Priority */}
              <div>
                <label className="field-label">Priority</label>
                <div className="priority-row">
                  {[
                    { id: 'high', label: '🔴 High' },
                    { id: 'medium', label: '🟣 Med' },
                    { id: 'low', label: '🟢 Low' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`prio-btn prio-${p.id === 'medium' ? 'med' : p.id} ${note.tag === p.id ? 'active' : ''}`}
                      onClick={() => setNote({ ...note, tag: p.id })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode tabs */}
              <div>
                <label className="field-label">Content Type</label>
                <div className="modal-tabs">
                  <button
                    type="button"
                    className={`modal-tab-btn ${activeModalTab === 'plaintext' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModalTab('plaintext');
                      if (builderSubtasks.length > 0) syncBuilderToDescription(builderSubtasks);
                    }}
                  >
                    📝 Text / Links / Docs
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${activeModalTab === 'structured' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModalTab('structured');
                      if (builderSubtasks.length === 0 && note.description.trim()) {
                        const a = analyzeContent('', note.description);
                        if (a.type === 'subtasks' && a.data) setBuilderSubtasks(a.data.items);
                      }
                    }}
                  >
                    📋 Subtask Builder ({builderSubtasks.length})
                  </button>
                </div>
              </div>

              {/* TAB 1: Plain text */}
              {activeModalTab === 'plaintext' && (
                <div>
                  <div className="presets-bar" style={{ marginBottom: 8 }}>
                    <span className="presets-label">⚡ Presets:</span>
                    {[
                      { key: 'websites', label: '🔗 Websites' },
                      { key: 'interview', label: '💼 Interview' },
                      { key: 'docs', label: '📄 Docs' },
                      { key: 'sprint', label: '🚀 Sprint' },
                    ].map((p) => (
                      <button key={p.key} type="button" className="preset-btn" onClick={() => handleApplyPresetTemplate(p.key)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="task-desc"
                    name="description"
                    className="field-textarea"
                    value={note.description}
                    rows={4}
                    onChange={onChange}
                    minLength={3}
                    placeholder="Enter text, { [Free4Talk] , [Speak & improve] }, bullet lists, code snippets..."
                    required
                  />
                </div>
              )}

              {/* TAB 2: Subtask Builder */}
              {activeModalTab === 'structured' && (
                <div>
                  <div className="builder-row" style={{ marginBottom: 8 }}>
                    <input
                      type="text"
                      className="builder-topic-input"
                      placeholder="Subtask topic — press Enter to add..."
                      value={newSubtaskTopic}
                      onChange={(e) => setNewSubtaskTopic(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtaskToBuilder(); } }}
                    />
                    <select
                      className="builder-status-select"
                      value={newSubtaskStatus}
                      onChange={(e) => setNewSubtaskStatus(e.target.value)}
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="in-progress">⚡ In Progress</option>
                      <option value="completed">✅ Done</option>
                    </select>
                    <button type="button" className="builder-add-btn" onClick={handleAddSubtaskToBuilder} disabled={!newSubtaskTopic.trim()}>
                      Add
                    </button>
                  </div>

                  <div className="builder-list">
                    {builderSubtasks.length === 0 ? (
                      <div className="builder-empty-msg">No subtasks yet — type above or pick a preset!</div>
                    ) : (
                      builderSubtasks.map((item, idx) => {
                        const statusType = getSubtaskStatusType(item.status);
                        return (
                          <div key={item.id || idx} className="builder-item">
                            <span className="builder-idx">{idx + 1}.</span>
                            <input
                              type="text"
                              className="builder-item-input"
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
                              className={getBuilderStatusClass(statusType)}
                              onClick={() => handleCycleBuilderStatus(idx)}
                            >
                              {getBuilderStatusLabel(statusType)}
                            </button>
                            <button type="button" className="builder-trash" onClick={() => handleRemoveBuilderSubtask(idx)}>
                              <ion-icon name="trash-outline"></ion-icon>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="modal-foot">
                <button type="button" className="btn-cancel" onClick={handleCancelTask} disabled={isbtnLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={isbtnLoading || note.title.length < 3}>
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
