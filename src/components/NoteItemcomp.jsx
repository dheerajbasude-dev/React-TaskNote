import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import './Note.css';
import noteContext from '../context/notes/noteContext';
import { useNavigate } from 'react-router-dom';
import { DotPulse } from '@uiball/loaders';
import { marked } from 'marked';
import hljs from 'highlight.js';
import TaskCompletedSound from './Sounds/TaskCompleted.mp3';
import UnCompletedTaskSound from './Sounds/UnCompletedTask.mp3';
import TaskDeleted1Sound from './Sounds/TaskDeleted1.mp3';
import TaskDeleted2Sound from './Sounds/TaskDeleted2.mp3';
import AddTaskSound from './Sounds/AddTask.mp3';
import EditTaskSound from './Sounds/Edited.mp3';
import Skeleton from 'react-loading-skeleton';
import './Skeleton.css';
import ArrowCircleUpSharpIcon from '@mui/icons-material/ArrowCircleUpSharp';

// Configure marked with GitHub-Flavored Markdown & VS Code JellyFish syntax highlighting
const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }) {
  const code = text || '';
  const language = (lang || '').trim().toLowerCase();
  let highlighted = '';

  try {
    if (language && hljs.getLanguage(language)) {
      highlighted = hljs.highlight(code, { language }).value;
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  } catch (err) {
    highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const displayLang = (language || 'code').toUpperCase();

  return `
    <div class="sleek-code-container vs-jellyfish-theme" draggable="false">
      <div class="sleek-code-header-bar">
        <div class="sleek-code-header-left">
          <span class="code-dot red"></span>
          <span class="code-dot yellow"></span>
          <span class="code-dot green"></span>
          <span class="code-lang-badge">${displayLang}</span>
        </div>
        <button type="button" class="sleek-code-copy-btn" title="Copy code">
          <span class="copy-text">Copy</span>
        </button>
      </div>
      <pre class="sleek-code-pre"><code class="hljs ${language ? `language-${language}` : ''}">${highlighted}</code></pre>
    </div>
  `;
};

renderer.link = function (arg) {
  const href = (typeof arg === 'string' ? arg : arg?.href) || '';
  const title = (typeof arg === 'object' ? arg?.title : arguments[1]) || '';
  const text = (typeof arg === 'object' ? arg?.text : arguments[2]) || href;

  const safeHref = href.replace(/"/g, '&quot;');
  const safeTitle = title ? ` title="${title.replace(/"/g, '&quot;')}"` : ` title="${safeHref}"`;

  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="sleek-md-link"${safeTitle} draggable="false"><span class="md-link-icon"><ion-icon name="link-outline"></ion-icon></span><span class="md-link-text">${text}</span><span class="md-link-arrow">↗</span></a>`;
};

marked.use({ renderer });
marked.setOptions({
  gfm: true,
  breaks: true,
});

// ============================================================================
// CONTENT CLASSIFIER & PARSER
// ============================================================================

export const parseSubtaskItem = (rawString, index = 0) => {
  if (!rawString || typeof rawString !== 'string') {
    return null;
  }

  const trimmed = rawString.trim();
  if (!trimmed) return null;

  // 1. Markdown checklist: - [x] Topic or * [ ] Topic
  const mdMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
  if (mdMatch) {
    return {
      id: `subtask-${index}`,
      topic: mdMatch[2].trim(),
      status: mdMatch[1].toLowerCase() === 'x' ? 'completed' : 'pending',
      isExplicitDash: true,
    };
  }

  // 2. Explicit dash format: e.g. "java: 22--completed", "Java: 14--pending", "Java 13--completed", "SpringBoot 4--in-progress"
  const dashStatusMatch = trimmed.match(/^(.*?)(?:--|-{2,})(completed|pending|in-progress|done|todo|progress|doing|finished|complete)$/i);
  if (dashStatusMatch) {
    let topicPart = dashStatusMatch[1].trim();
    const statusPart = dashStatusMatch[2].trim();
    topicPart = `${topicPart}--`;
    return {
      id: `subtask-${index}`,
      topic: topicPart,
      status: statusPart,
      isExplicitDash: true,
    };
  }

  // 3. Colon + status format: e.g. "Java 13: completed", "Topic: pending"
  const colonStatusMatch = trimmed.match(/^(.*?):\s*(completed|pending|in-progress|done|todo|progress|doing|finished|complete)$/i);
  if (colonStatusMatch) {
    const topicPart = colonStatusMatch[1].trim();
    const statusPart = colonStatusMatch[2].trim();
    return {
      id: `subtask-${index}`,
      topic: topicPart,
      status: statusPart,
      isExplicitDash: false,
    };
  }

  // 4. Space-separated status keyword (only valid in multi-item lists): e.g. "Interview pending", "DSA completed"
  const spaceStatusMatch = trimmed.match(/^(.*?)\s+(completed|pending|in-progress|done|todo|progress|doing|finished|complete)$/i);
  if (spaceStatusMatch) {
    return {
      id: `subtask-${index}`,
      topic: spaceStatusMatch[1].trim(),
      status: spaceStatusMatch[2].trim(),
      isExplicitDash: false,
    };
  }

  return null;
};

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

  for (let i = 0; i < linesOrParts.length; i++) {
    const part = linesOrParts[i];
    const parsed = parseSubtaskItem(part, i);
    if (parsed && parsed.topic && parsed.topic.length < 120) {
      genuineSubtasks.push(parsed);
    }
  }

  // Strictly classify as Subtasks:
  // - For multiple items (>= 2): when valid subtasks are present
  // - For a single item (1): ONLY when it explicitly has the dash format (e.g. java: 22--completed) or Markdown checklist (- [ ])
  const isGenuineSubtaskCollection =
    (genuineSubtasks.length >= 2 && genuineSubtasks.length >= Math.floor(linesOrParts.length * 0.6)) ||
    (genuineSubtasks.length === 1 && linesOrParts.length === 1 && genuineSubtasks[0].isExplicitDash);

  if (isGenuineSubtaskCollection) {
    const totalCount = genuineSubtasks.length;
    const completedCount = genuineSubtasks.filter((item) => {
      const s = item.status.toLowerCase();
      return s.includes('completed') || s.includes('done') || s === 'finished' || s === 'complete';
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

  // 2. Image / Media Check (Markdown ![alt](url) or direct image URL)
  const hasMarkdownImg = /!\[(.*?)\]\(([^\)]+)\)/i.test(trimmed);
  const hasDirectImg = /(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s)]*)?)/i.test(trimmed) || /https?:\/\/images\.unsplash\.com\/[^\s)]+/i.test(trimmed);

  if (hasMarkdownImg || hasDirectImg) {
    return {
      type: 'image',
      label: 'Image',
      icon: 'image-outline',
      color: '#ec4899',
      data: {
        hasImage: true,
        lineCount: trimmed.split('\n').length,
      },
      rawText: safeDesc,
    };
  }

  // 3. Links & Resources Check (Ignore Markdown images starting with !)
  const bracketMatches = [...trimmed.matchAll(/(?<!\!)\[([^\]]+)\](?:\(([^)]+)\))?/g)];
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

  // 4. Documentation / Code Explanation
  const isCode =
    trimmed.includes('```') ||
    trimmed.includes('public class') ||
    trimmed.includes('public static void') ||
    trimmed.includes('System.out.println') ||
    trimmed.includes('const ') ||
    trimmed.includes('function ') ||
    trimmed.includes('import ') ||
    trimmed.includes('def ') ||
    trimmed.includes('=>');

  const isDoc =
    trimmed.includes('```') ||
    trimmed.startsWith('#') ||
    trimmed.includes('\n#') ||
    trimmed.includes('##') ||
    trimmed.includes('\n- ') ||
    trimmed.includes('\n* ') ||
    trimmed.includes('\n1. ') ||
    trimmed.startsWith('- ') ||
    trimmed.startsWith('* ') ||
    trimmed.startsWith('1. ') ||
    trimmed.split('\n').length >= 2;

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

export const updateSubtaskItemInDescription = (currentDesc, targetIndex, newTopic, newStatus) => {
  const safeDesc = typeof currentDesc === 'string' ? currentDesc : '';
  const trimmed = safeDesc.trim();
  const isNewline = trimmed.includes('\n');
  const separator = isNewline ? '\n' : ' , ';
  const parts = isNewline
    ? trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

  if (targetIndex < 0 || targetIndex >= parts.length) return currentDesc;

  const part = parts[targetIndex];
  const cleanTopic = newTopic.trim();
  const cleanStatus = newStatus.trim();

  const mdMatch = part.match(/^([-*]\s*)\[([ xX])\]\s*(.*)$/);
  if (mdMatch) {
    const isDone = cleanStatus.toLowerCase().includes('completed') || cleanStatus.toLowerCase().includes('done');
    parts[targetIndex] = `${mdMatch[1]}[${isDone ? 'x' : ' '}] ${cleanTopic}`;
  } else if (cleanTopic.endsWith('-') || cleanTopic.endsWith('--')) {
    parts[targetIndex] = `${cleanTopic}${cleanStatus}`;
  } else if (part.includes(':')) {
    parts[targetIndex] = `${cleanTopic}: ${cleanStatus}`;
  } else {
    parts[targetIndex] = `${cleanTopic} ${cleanStatus}`;
  }

  return parts.join(separator);
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
    newStatus = 'completed';
  } else {
    newStatus = 'pending';
  }

  return updateSubtaskItemInDescription(currentDesc, targetIndex, item.topic, newStatus);
};

export const deleteSubtaskItemFromDescription = (currentDesc, targetIndex) => {
  const safeDesc = typeof currentDesc === 'string' ? currentDesc : '';
  const trimmed = safeDesc.trim();
  const isNewline = trimmed.includes('\n');
  const separator = isNewline ? '\n' : ' , ';
  const parts = isNewline
    ? trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

  if (targetIndex < 0 || targetIndex >= parts.length) return currentDesc;

  parts.splice(targetIndex, 1);
  return parts.join(separator);
};

// ============================================================================
// PURE GFM MARKDOWN RENDERER (100% SPEC COMPLIANT WITH SYNTAX CODE BOXES)
// ============================================================================
const PureMarkdownRenderer = ({ content }) => {
  const containerRef = useRef(null);

  const rawHtml = React.useMemo(() => {
    if (!content) return '';
    try {
      let html = marked.parse(content);
      // Ensure all links open in a new tab safely
      html = html.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="sleek-md-link"$2>');
      return html;
    } catch (e) {
      console.warn('Markdown parse error:', e);
      return content;
    }
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Attach copy button listeners to all rendered code blocks
    const copyButtons = containerRef.current.querySelectorAll('.sleek-code-copy-btn');
    copyButtons.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const codeBlock = btn.closest('.sleek-code-container')?.querySelector('pre code');
        const text = codeBlock ? codeBlock.innerText : '';
        if (text) {
          navigator.clipboard.writeText(text);
          btn.innerHTML = `<span class="copy-text copied">Copied! ✓</span>`;
          setTimeout(() => {
            btn.innerHTML = `<span class="copy-text">Copy</span>`;
          }, 2000);
        }
      };
    });

    // Make all embedded images interactive
    const imgElements = containerRef.current.querySelectorAll('img');
    imgElements.forEach((img) => {
      img.classList.add('sleek-card-embedded-img');
      img.onclick = (e) => {
        e.stopPropagation();
        window.open(img.src, '_blank', 'noopener,noreferrer');
      };
    });

    // Make all links isolate propagation so card click is not triggered
    const linkElements = containerRef.current.querySelectorAll('a');
    linkElements.forEach((link) => {
      link.onclick = (e) => {
        e.stopPropagation();
      };
    });
  }, [rawHtml]);

  if (!content) return null;

  return (
    <div
      ref={containerRef}
      className="sleek-pure-markdown"
      draggable={false}
      onDragStart={(e) => e.stopPropagation()}
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
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

  // Delete Confirmation Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Single Subtask Quick Editor state
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [isSubtaskSaving, setIsSubtaskSaving] = useState(false);
  const [isSubtaskDeleting, setIsSubtaskDeleting] = useState(false);

  // Drag & Drop State (Activated exclusively on 3-times click / Triple-Click)
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const clickCountRef = useRef({ id: null, count: 0, lastTime: 0 });

  // Trigger vibration / haptic feedback & highlight card ready to drag
  const handleActivateDrag = useCallback((noteItem) => {
    if (!noteItem) return;
    setActiveDragId(noteItem._id);
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([50, 40, 50]);
      } catch (err) {}
    }
  }, []);

  // 3-Times Click (Triple-Click) Handler
  const handleTaskTripleClick = (e, noteItem) => {
    if (!noteItem) return;

    // 1. Native DOM event counter (3 clicks in rapid succession)
    if (e.detail === 3) {
      handleActivateDrag(noteItem);
      clickCountRef.current = { id: null, count: 0, lastTime: 0 };
      return;
    }

    // 2. High-precision fallback counter within 450ms window
    const now = Date.now();
    if (clickCountRef.current.id === noteItem._id && now - clickCountRef.current.lastTime < 450) {
      const newCount = clickCountRef.current.count + 1;
      clickCountRef.current = { id: noteItem._id, count: newCount, lastTime: now };
      if (newCount >= 3) {
        handleActivateDrag(noteItem);
        clickCountRef.current = { id: null, count: 0, lastTime: 0 };
      }
    } else {
      clickCountRef.current = { id: noteItem._id, count: 1, lastTime: now };
    }
  };

  // Dismiss drag-ready mode if clicked outside
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (activeDragId && !e.target.closest('.sleek-task-row.is-drag-ready')) {
        setActiveDragId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeDragId]);

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
    setEditingNote(null);
  };

  const handleCancelTask = useCallback(() => {
    closeModal();
    setNote({ title: '', description: '', tag: 'medium' });
  }, []);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setTaskToDelete(null);
    setDeleteConfirmInput('');
    setIsDeleting(false);
  }, []);

  const openModal = () => {
    setShowModal(true);
    setIsEditing(false);
    setEditingNote(null);
    setNote({ title: '', description: '', tag: 'medium' });
  };

  const playRandomDeleteSound = () => {
    playSound(Math.random() < 0.5 ? TaskDeleted1Sound : TaskDeleted2Sound);
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
  const handleDragStart = (e, index, noteItem) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      e.preventDefault();
      return;
    }
    setDraggingIndex(index);
    if (noteItem) {
      setActiveDragId(noteItem._id);
    }
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
      setActiveDragId(null);
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
    setActiveDragId(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
    setActiveDragId(null);
  };

  // Add / Edit task submission
  const handleAddTask = async (e) => {
    e.preventDefault();
    setIsbtnLoading(true);

    const finalDescription = note.description.trim();

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

  // Open modal for editing
  const handleEditClick = (e, noteItem) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsEditing(true);
    setEditingNote(noteItem);

    setNote({
      title: noteItem.title,
      description: noteItem.description,
      tag: noteItem.tag || 'medium',
    });
    setShowModal(true);
  };

  // Open delete confirmation modal
  const handleOpenDeleteModal = (e, noteItem) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setTaskToDelete(noteItem);
    setDeleteConfirmInput('');
    setShowDeleteModal(true);
  };

  // Aliases for compatibility
  const updateNote = (noteItem) => handleEditClick({ stopPropagation: () => {} }, noteItem);
  const taskDeleted = (e, noteItem) => handleOpenDeleteModal(e, noteItem);

  // Confirm delete handler
  const handleConfirmDelete = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (deleteConfirmInput.trim().toUpperCase() !== 'DELETE' || !taskToDelete) return;
    setIsDeleting(true);
    try {
      await deleteNote(taskToDelete._id);
      playRandomDeleteSound();
      handleCancelDelete();
    } catch (err) {
      console.warn('Delete failed', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle completion with sound
  const toggleNoteCompletion = (noteItem) => {
    const newStatus = !noteItem.completed;
    updateNoteCompletedStatus(noteItem._id, newStatus);
    if (newStatus) {
      playSound(TaskCompletedSound);
    } else {
      playSound(UnCompletedTaskSound);
    }
  };

  // Open Single Subtask Quick Editor
  const handleOpenSubtaskEditor = (e, noteItem, subtaskIdx, subItem) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setEditingSubtask({
      noteId: noteItem._id,
      noteItem: noteItem,
      index: subtaskIdx,
      topic: subItem.topic,
      status: subItem.status || 'pending',
    });
  };

  // Close Subtask Editor
  const handleCloseSubtaskEditor = () => {
    setEditingSubtask(null);
  };

  // Save changes to single subtask
  const handleSaveSubtask = async (e) => {
    if (e) e.preventDefault();
    if (!editingSubtask || isSubtaskSaving) return;

    const { noteItem, index, topic, status } = editingSubtask;
    if (!topic.trim()) return;

    setIsSubtaskSaving(true);
    const updatedDesc = updateSubtaskItemInDescription(
      noteItem.description,
      index,
      topic.trim(),
      status
    );

    try {
      await editNote(noteItem._id, noteItem.title, updatedDesc, noteItem.tag);
      playSound(EditTaskSound);
      handleCloseSubtaskEditor();
    } catch (err) {
      console.warn('Failed to save subtask:', err);
    } finally {
      setIsSubtaskSaving(false);
    }
  };

  // Delete single subtask
  const handleDeleteSubtask = async (e) => {
    if (e) e.preventDefault();
    if (!editingSubtask || isSubtaskDeleting) return;

    const { noteItem, index } = editingSubtask;
    setIsSubtaskDeleting(true);
    const updatedDesc = deleteSubtaskItemFromDescription(noteItem.description, index);

    try {
      await editNote(noteItem._id, noteItem.title, updatedDesc, noteItem.tag);
      playRandomDeleteSound();
      handleCloseSubtaskEditor();
    } catch (err) {
      console.warn('Failed to delete subtask:', err);
    } finally {
      setIsSubtaskDeleting(false);
    }
  };

  // Subtask click within a card
  const handleCardSubtaskClick = (e, noteItem, subtaskIdx) => {
    e.stopPropagation();
    const updatedDesc = toggleSubtaskItemStatus(noteItem.description, subtaskIdx);
    editNote(noteItem._id, noteItem.title, updatedDesc, noteItem.tag);
  };

  // Open resource link
  const handleOpenResource = (e, url) => {
    e.stopPropagation();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Priority color helper
  const getPriorityColor = (tag) => {
    switch (tag?.toLowerCase()) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6366f1';
    }
  };

  // Highlight search matches
  const highlightMatches = (text, query) => {
    if (!query || !text) return text;
    const cleanQuery = query.trim();
    if (!cleanQuery) return text;

    const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);

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
            <div className="sleek-empty-icon-wrap">
              <ion-icon name={searchQuery ? 'search-outline' : 'checkbox-outline'}></ion-icon>
            </div>
            <h4>{searchQuery ? 'No matching tasks found' : 'All caught up! No tasks left.'}</h4>
            <p>
              {searchQuery
                ? `No tasks found matching "${searchQuery}". Try a different keyword.`
                : 'Your workspace is clear. Create a new task to stay organized and productive.'}
            </p>
            <div className="sleek-empty-actions">
              {searchQuery && (
                <button
                  type="button"
                  className="empty-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <ion-icon name="close-circle-outline"></ion-icon>
                  <span>Clear Search</span>
                </button>
              )}
              <button
                type="button"
                className="empty-add-btn"
                onClick={openModal}
              >
                <ion-icon name="add"></ion-icon>
                <span>Create Task</span>
              </button>
            </div>
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
                  className={`sleek-task-row ${isFirst ? 'is-spotlight-focus' : ''} ${noteItem.completed ? 'is-completed' : ''} ${activeDragId === noteItem._id ? 'is-drag-ready' : ''} ${isItemDragging ? 'is-dragging' : ''} ${isItemOver ? 'drag-over' : ''}`}
                  data-index={index}
                  key={noteItem._id}
                  draggable={activeDragId === noteItem._id}
                  onClick={(e) => handleTaskTripleClick(e, noteItem)}
                  onDragStart={(e) => handleDragStart(e, index, noteItem)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    '--row-accent': getPriorityColor(noteItem.tag),
                  }}
                  title={activeDragId === noteItem._id ? 'Ready to move! Drag up/down to reorder' : 'Click 3 times to activate drag reordering'}
                >
                  {/* Top Header Line: Index -> Title -> Priority -> Date & Actions */}
                  <div className="sleek-row-header">
                    <div className="sleek-row-header-left">
                      {/* 1. Index Number */}
                      <span className="sleek-task-index">
                        #{index + 1}
                      </span>

                      {/* 2. Title */}
                      <span
                        className={`sleek-task-title ${noteItem.completed ? 'strike' : ''}`}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                      >
                        {searchQuery ? highlightMatches(noteItem.title, searchQuery) : noteItem.title}
                      </span>

                      {/* 3. Priority Tag */}
                      <span
                        className="sleek-priority-tag"
                        style={{
                          color: getPriorityColor(noteItem.tag),
                          backgroundColor: `${getPriorityColor(noteItem.tag)}12`,
                        }}
                      >
                        {(noteItem.tag || 'medium').slice(0, 3).toUpperCase()}
                      </span>

                      {/* 4. Drag Ready Glow Badge */}
                      {activeDragId === noteItem._id && (
                        <span className="sleek-drag-ready-badge" title="Drag up/down to reorder">
                          <ion-icon name="hand-right"></ion-icon>
                          <span>Ready to Drag</span>
                        </span>
                      )}
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
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          title={noteItem.completed ? 'Mark pending' : 'Mark done'}
                        >
                          <ion-icon name={noteItem.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}></ion-icon>
                        </button>

                        <button
                          type="button"
                          className="sleek-icon-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(e, noteItem);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          title="Edit Task"
                        >
                          <ion-icon name="create-outline"></ion-icon>
                        </button>

                        <button
                          type="button"
                          className="sleek-icon-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeleteModal(e, noteItem);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          title="Delete Task"
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
                            const isDashSuffix = Boolean(subItem.topic && subItem.topic.trim().endsWith('-'));
                            return (
                              <button
                                key={subItem.id || sIdx}
                                type="button"
                                className={`sleek-subtask-pill status-${statusType} ${isDashSuffix ? 'has-dash-suffix' : ''}`}
                                onClick={(e) => handleOpenSubtaskEditor(e, noteItem, sIdx, subItem)}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                title={`Click to edit "${subItem.topic}"`}
                              >
                                <span className="pill-topic">
                                  {searchQuery ? highlightMatches(subItem.topic, searchQuery) : subItem.topic}
                                </span>
                                <span className="pill-status">
                                  {searchQuery ? highlightMatches(subItem.status, searchQuery) : subItem.status}
                                </span>
                                <span className="pill-edit-hint">
                                  <ion-icon name="create-outline"></ion-icon>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* PURE GFM MARKDOWN (.md) RENDERER FOR ALL TASKS & DESCRIPTIONS */}
                    {analysis.type !== 'subtasks' && (
                      <PureMarkdownRenderer content={noteItem.description} />
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

              {/* Description (Pure Markdown .md) */}
              <div className="modal-tab-body">
                <textarea
                  id="task-desc"
                  name="description"
                  className="sleek-textarea"
                  value={note.description}
                  rows={6}
                  onChange={onChange}
                  minLength={3}
                  placeholder="Write description in Markdown (.md)... Supports - bullets, 1. numbered lists, [links](url), ## headings, code blocks, and images."
                  required
                ></textarea>
              </div>

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

      {/* Sleek Glassmorphic Delete Confirmation Modal */}
      {showDeleteModal && taskToDelete && (
        <div
          className="sleek-modal-overlay"
          onClick={handleCancelDelete}
        >
          <div
            className="sleek-delete-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sleek-delete-modal-header">
              <div className="sleek-delete-icon-orb">
                <ion-icon name="trash-outline"></ion-icon>
              </div>
              <div className="sleek-delete-header-text">
                <h2>Delete Task</h2>
                <p>This action is permanent and cannot be undone.</p>
              </div>
              <button
                type="button"
                className="sleek-modal-close-btn"
                onClick={handleCancelDelete}
                aria-label="Close"
              >
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="sleek-delete-modal-body">
              <div className="sleek-delete-target-preview">
                <span className="preview-label">Task:</span>
                <span className="preview-title">{taskToDelete.title}</span>
              </div>

              <div className="sleek-delete-input-group">
                <label htmlFor="delete-confirm-input">
                  Type <strong>DELETE</strong> to enable the delete button:
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  className="sleek-delete-input"
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </div>

              <div className="sleek-delete-modal-footer">
                <button
                  type="button"
                  className="sleek-btn-cancel"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sleek-btn-danger"
                  disabled={deleteConfirmInput.trim().toUpperCase() !== 'DELETE' || isDeleting}
                >
                  {isDeleting ? (
                    <DotPulse size={16} color="#ffffff" />
                  ) : (
                    <>
                      <ion-icon name="trash-outline"></ion-icon>
                      <span>Delete Task</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleek Dedicated Edit Subtask Modal */}
      {editingSubtask && (
        <div className="sleek-modal-overlay" onClick={handleCloseSubtaskEditor}>
          <div className="sleek-subtask-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sleek-subtask-modal-header">
              <div className="subtask-header-title-wrap">
                <div className="subtask-modal-icon">
                  <ion-icon name="create-outline"></ion-icon>
                </div>
                <div>
                  <h3>Edit Subtask</h3>
                  <p className="subtask-modal-parent-name">
                    Task: <strong>{editingSubtask.noteItem?.title}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="sleek-modal-close-btn"
                onClick={handleCloseSubtaskEditor}
                aria-label="Close"
              >
                <ion-icon name="close"></ion-icon>
              </button>
            </div>

            <form onSubmit={handleSaveSubtask} className="sleek-subtask-modal-body">
              {/* Subtask Topic Input */}
              <div className="subtask-form-group">
                <label htmlFor="subtask-topic-input">Subtask Topic / Name</label>
                <input
                  id="subtask-topic-input"
                  type="text"
                  className="sleek-input-title"
                  value={editingSubtask.topic}
                  onChange={(e) =>
                    setEditingSubtask({ ...editingSubtask, topic: e.target.value })
                  }
                  placeholder="e.g. Java 13, SpringBoot 4, Interview prep..."
                  required
                  autoFocus
                />
              </div>

              {/* Status Selector Pills */}
              <div className="subtask-form-group">
                <label>Status</label>
                <div className="sleek-subtask-status-selector">
                  <button
                    type="button"
                    className={`subtask-status-opt pending ${
                      getSubtaskStatusType(editingSubtask.status) === 'pending' ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setEditingSubtask({ ...editingSubtask, status: 'pending' })
                    }
                  >
                    <ion-icon name="hourglass-outline"></ion-icon>
                    <span>Pending</span>
                  </button>

                  <button
                    type="button"
                    className={`subtask-status-opt in-progress ${
                      getSubtaskStatusType(editingSubtask.status) === 'in-progress' ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setEditingSubtask({ ...editingSubtask, status: 'in-progress' })
                    }
                  >
                    <ion-icon name="flash-outline"></ion-icon>
                    <span>In Progress</span>
                  </button>

                  <button
                    type="button"
                    className={`subtask-status-opt completed ${
                      getSubtaskStatusType(editingSubtask.status) === 'completed' ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setEditingSubtask({ ...editingSubtask, status: 'completed' })
                    }
                  >
                    <ion-icon name="checkmark-circle"></ion-icon>
                    <span>Completed</span>
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="sleek-subtask-modal-footer">
                <button
                  type="button"
                  className="subtask-btn-delete"
                  onClick={handleDeleteSubtask}
                  disabled={isSubtaskSaving || isSubtaskDeleting}
                  title="Delete this subtask from task"
                >
                  {isSubtaskDeleting ? (
                    <DotPulse size={14} color="#ef4444" />
                  ) : (
                    <>
                      <ion-icon name="trash-outline"></ion-icon>
                      <span>Delete</span>
                    </>
                  )}
                </button>

                <div className="subtask-footer-right">
                  <button
                    type="button"
                    className="sleek-btn-cancel"
                    onClick={handleCloseSubtaskEditor}
                    disabled={isSubtaskSaving || isSubtaskDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sleek-btn-submit"
                    disabled={!editingSubtask.topic.trim() || isSubtaskSaving || isSubtaskDeleting}
                  >
                    {isSubtaskSaving ? (
                      <DotPulse size={16} color="#ffffff" />
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notescomp;
