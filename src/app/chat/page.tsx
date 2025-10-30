'use client';

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, AlertCircle, Download, Bot, User, Plus } from 'lucide-react';
import { matchTemplateStream, getQuestions, generateDraft } from '@/lib/api';
import type { 
  TemplateMatch, 
  Question, 
  GenerateDraftResponseBody 
} from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast from '@/components/Toast';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun } from 'docx';

type Message = {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    templateMatches?: TemplateMatch[];
    questions?: Question[];
    draft?: GenerateDraftResponseBody;
    prefilled?: Record<string, string | number | boolean | null>;
  };
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  templateId?: string;
  questions?: Question[];
  answers?: Record<string, string | number | boolean | null>;
  draft?: GenerateDraftResponseBody;
};

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-900">
      <LoadingSpinner size="lg" />
    </div>}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || '';
  const draftMode = searchParams.get('mode') === 'draft';
  const templateId = searchParams.get('templateId') || '';
  
  // Chat history state
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Template matching state
  const [topMatch, setTopMatch] = useState<TemplateMatch | null>(null);
  const [alternatives, setAlternatives] = useState<TemplateMatch[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // Questions state
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | null>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [prefilledFields, setPrefilledFields] = useState<Record<string, string | number | boolean | null>>({});
  
  // Draft state
  const [draft, setDraft] = useState<GenerateDraftResponseBody | null>(null);
  
  // Sidebar state
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<'variables' | 'document'>('variables');

  // Slash command state
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasInitializedRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        const historyWithDates = parsed.map((chat: Omit<ChatSession, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string; messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }> }) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setChatHistory(historyWithDates);
      } catch (error) {
        console.error('Failed to parse chat history:', error);
      }
    }
  }, []);

  // Generate a title from the first user message
  const generateChatTitle = (firstMessage: string): string => {
    // Use the first message as the title without truncation
    return firstMessage.trim();
  };

  // Update current chat in history
  const updateCurrentChatInHistory = useCallback(() => {
    if (!currentChatId || messages.length === 0) return;
    
    const firstUserMessage = messages.find(msg => msg.type === 'user');
    const title = firstUserMessage ? generateChatTitle(firstUserMessage.content) : 'New Chat';
    
    const updatedChat: ChatSession = {
      id: currentChatId,
      title,
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
      templateId: selectedTemplateId || undefined,
      questions: questions.length > 0 ? questions : undefined,
      answers: Object.keys(answers).length > 0 ? answers : undefined,
      draft: draft || undefined
    };
    
    setChatHistory(prev => {
      const existingIndex = prev.findIndex(chat => chat.id === currentChatId);
      if (existingIndex >= 0) {
        // Update existing chat
        const updated = [...prev];
        updated[existingIndex] = updatedChat;
        return updated;
      } else {
        // Add new chat to history
        return [updatedChat, ...prev];
      }
    });
  }, [currentChatId, messages, selectedTemplateId, questions, answers, draft]);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Update current chat in history when relevant state changes
  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      updateCurrentChatInHistory();
    }
  }, [messages, selectedTemplateId, questions, answers, draft, currentChatId, updateCurrentChatInHistory]);

  // Create a new chat session
  const createNewChat = useCallback((): string => {
    const newChatId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    // Save current chat to history if it has messages
    if (currentChatId && messages.length > 0) {
      const firstUserMessage = messages.find(msg => msg.type === 'user');
      const title = firstUserMessage ? generateChatTitle(firstUserMessage.content) : 'New Chat';
      
      const currentChat: ChatSession = {
        id: currentChatId,
        title,
        messages,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateId: selectedTemplateId || undefined,
        questions: questions.length > 0 ? questions : undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
        draft: draft || undefined
      };
      
      // Check if this chat already exists in history
      const existingChatIndex = chatHistory.findIndex(chat => chat.id === currentChatId);
      
      if (existingChatIndex >= 0) {
        // Update existing chat
        setChatHistory(prev => prev.map((chat, index) => 
          index === existingChatIndex ? currentChat : chat
        ));
      } else {
        // Add new chat to history
        setChatHistory(prev => [currentChat, ...prev]);
      }
    }
    
    // Start fresh chat
    setCurrentChatId(newChatId);
    setMessages([]);
    setUserQuery('');
    setError(null);
    setIsLoading(false);
    setTopMatch(null);
    setAlternatives([]);
    setSelectedTemplateId(null);
    setAnswers({});
    setQuestions([]);
    setPrefilledFields({});
    setDraft(null);
    setShowSidebar(false);
    setActiveTab('variables');
    
    return newChatId;
  }, [currentChatId, messages, selectedTemplateId, questions, answers, draft, chatHistory]);

  // Switch to an existing chat
  const switchToChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setCurrentChatId(chatId);
      setMessages(chat.messages);
      setSelectedTemplateId(chat.templateId || null);
      setQuestions(chat.questions || []);
      setAnswers(chat.answers || {});
      setPrefilledFields({}); // Reset prefilled fields when switching chats
      setDraft(chat.draft || null);
      
      // Show sidebar if there are questions or a draft
      const shouldShowSidebar = (chat.questions && chat.questions.length > 0) || !!chat.draft;
      setShowSidebar(shouldShowSidebar);
      
      // Set active tab based on what's available
      if (chat.draft) {
        setActiveTab('document');
      } else if (chat.questions && chat.questions.length > 0) {
        setActiveTab('variables');
      } else {
        setActiveTab('variables');
      }
    }
  };

  // Available slash commands
  const commands = useMemo(() => {
    const filledCount = Object.keys(answers).filter(key => 
      answers[key] !== null && answers[key] !== undefined && answers[key] !== ''
    ).length;
    
    return [
      {
        command: '/draft',
        description: 'Create a new document draft',
        action: () => {
          setUserQuery('');
          setShowCommands(false);
          setCommandFilter('');
          // Focus input and add placeholder text
          inputRef.current?.focus();
          setUserQuery('I need a new document draft for...');
        }
      },
      {
        command: '/vars',
        description: questions.length > 0 
          ? `Show variables (${filledCount}/${questions.length} filled)`
          : 'Show variables form',
        action: () => {
          setUserQuery('');
          setShowCommands(false);
          setCommandFilter('');
          // Check if questions are available
          if (questions.length === 0) {
            setToast({ 
              message: 'Please select a template first to view variables. Type your document request to get started!', 
              type: 'info' 
            });
      return;
    }
          // Show toast with progress
          setToast({ 
            message: `Variables progress: ${filledCount}/${questions.length} filled`, 
            type: 'info' 
          });
          // Open sidebar and focus on variables tab
          setShowSidebar(true);
          setActiveTab('variables');
          // Focus on the first input field after a short delay
          setTimeout(() => {
            const firstInput = document.querySelector('#variables-form input') as HTMLInputElement;
            firstInput?.focus();
          }, 100);
        }
      }
    ];
  }, [questions, answers]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Global key handler for slash command
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Only handle if the slash key is pressed and not already in an input field
      if (e.key === '/' && e.target && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setUserQuery('/');
        setShowCommands(true);
        setCommandFilter('');
      }
    };

    document.addEventListener('keydown', handleGlobalKeyPress);
    return () => document.removeEventListener('keydown', handleGlobalKeyPress);
  }, []);

  // Focus input when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages.length]);

  // Prevent body scrolling on chat page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const addMessage = (type: Message['type'], content: string, metadata?: Message['metadata'], replaceLast = false, appendToLast = false) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date(),
      metadata,
    };
    
    if (replaceLast) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = newMessage;
        return updated;
      });
    } else if (appendToLast) {
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + '\n\n' + content,
          };
        } else {
          updated.push(newMessage);
        }
        return updated;
      });
    } else {
      setMessages(prev => [...prev, newMessage]);
    }
  };

  const handleGetQuestions = useCallback(async (templateId: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await getQuestions(templateId, userQuery);
      
      // Initialize answers with prefilled values
      const prefilledAnswers: Record<string, string | number | boolean | null> = {};
      if (result.prefilled) {
        Object.entries(result.prefilled).forEach(([key, value]) => {
          prefilledAnswers[key] = value;
        });
      }
      setAnswers(prefilledAnswers);
      setPrefilledFields(result.prefilled || {});
      setQuestions(result.questions);
      
      // Show sidebar with variables tab
      setShowSidebar(true);
      setActiveTab('variables');
      
      if (result.questions.length === 0) {
        // No questions needed, directly generate the draft
        const draftResult = await generateDraft(templateId, {}, userQuery);
        setDraft(draftResult);
        addMessage('assistant', 'Your document has been generated. No variables were needed!', {
          draft: draftResult
        }, true);
        setActiveTab('document');
      } else {
        // Count prefilled fields for the message
        const prefilledCount = Object.keys(result.prefilled || {}).length;
        let message = `I need some information to generate your document. Please answer the ${result.questions.length} questions provided in the form`;
        
        if (prefilledCount > 0) {
          message += `\n\n🎉 **${prefilledCount} fields were automatically filled** from your query! You can review and modify them as needed.`;
        }
        
        // Append the questions to the last message
        addMessage('assistant', message, {
          questions: result.questions,
          prefilled: result.prefilled
        }, false, true);
      }
    } catch (err) {
      const error = err as Error;
      addMessage('assistant', `I encountered an error: ${error.message || 'Failed to generate questions'}. Please try again.`, undefined, true);
    } finally {
      setIsLoading(false);
    }
  }, [userQuery]);

  const handleStartMatching = useCallback(async (queryOverride?: string) => {
    const query = queryOverride || userQuery;
    
    if (!query.trim()) {
      setError('Please enter a description');
      return;
    }

    // Create a new chat if none exists
    if (!currentChatId) {
      createNewChat();
    }

    // Prevent duplicate calls
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    setError(null);
    setIsLoading(true);
    
    // Clear the input after adding user message
    if (!queryOverride) {
      setUserQuery('');
    }
    
    // Add user message FIRST
    addMessage('user', query);
    
    // Use SSE for real-time status updates
    matchTemplateStream(
      query,
      (update) => {
        // Update status message based on current status
        if (update.status === 'searching') {
          addMessage('assistant', '🔍 Searching for matching templates...');
        } else if (update.status === 'searching_web') {
          addMessage('assistant', '🌐 Searching the web for templates...', undefined, true);
        } else if (update.status === 'success' && update.data) {
          const result = update.data;
      
      if (!result.found || !result.top_match) {
            addMessage('assistant', 'I couldn&apos;t find a matching template for your request. Try uploading a document first or refining your query with more specific details about the legal document you need.', undefined, true);
            setIsLoading(false);
            isProcessingRef.current = false;
        return;
      }

      setTopMatch(result.top_match);
      setAlternatives(result.alternatives);
      
      if (result.alternatives.length > 0) {
            addMessage('assistant', `I found ${result.alternatives.length + 1} matching templates. Here are the options:`, {
              templateMatches: [result.top_match, ...result.alternatives]
            }, true);
      } else {
            addMessage('assistant', `Perfect! I found a matching template: "${result.top_match.title}". Let me generate some questions to help create your document.`, undefined, true);
        setSelectedTemplateId(result.top_match.template_id);
            handleGetQuestions(result.top_match.template_id);
          }
          setIsLoading(false);
          isProcessingRef.current = false;
        } else if (update.status === 'error') {
          addMessage('assistant', `I encountered an error: ${update.message || 'Failed to match template'}. Please try again.`, undefined, true);
          setIsLoading(false);
          isProcessingRef.current = false;
        } else if (update.status === 'no_templates') {
          addMessage('assistant', 'I couldn&apos;t find a matching template for your request. Try uploading a document first or refining your query with more specific details about the legal document you need.', undefined, true);
          setIsLoading(false);
          isProcessingRef.current = false;
        }
      },
      (error) => {
        addMessage('assistant', `I encountered an error: ${error.message || 'Connection failed'}. Please try again.`, undefined, true);
        setIsLoading(false);
        isProcessingRef.current = false;
      }
    );
  }, [userQuery, handleGetQuestions, currentChatId, createNewChat]);

  // Handle initial query from URL parameter
  useEffect(() => {
    if (messages.length === 0) {
      const key = `${initialQuery || ''}-${draftMode}-${templateId}`;
      
      if (hasInitializedRef.current !== key) {
        hasInitializedRef.current = key;
        
        if (templateId) {
          // Template ID from upload page: directly select this template
          if (!currentChatId) {
            createNewChat();
          }
          addMessage('assistant', 'Template selected from upload. Loading variables form...');
          setSelectedTemplateId(templateId);
          handleGetQuestions(templateId);
        } else if (draftMode) {
          // Draft mode: show welcome message without auto-submitting
          if (!currentChatId) {
            createNewChat();
          }
          // addMessage('assistant', '🎯 **Draft mode activated!**\n\nI\'m ready to help you create a document. Please describe what you need and I\'ll match it with the best template.');
          setUserQuery(''); // Clear the input
        } else if (initialQuery) {
          const query = initialQuery;
          // Auto-submit after a short delay
          setTimeout(() => {
            handleStartMatching(query);
          }, 500);
        }
      }
    }
  }, [initialQuery, draftMode, templateId, messages.length, handleGetQuestions, handleStartMatching, currentChatId, createNewChat]);

  const handleSelectTemplate = async (templateId: string) => {
    const template = alternatives.find(alt => alt.template_id === templateId) || topMatch;
    if (template) {
      // Add the selection message and then get questions
      addMessage('assistant', `Great choice! Lets use "${template.title}" to create your document. Let me generate some questions to gather the necessary information.`);
    }
    setSelectedTemplateId(templateId);
    await handleGetQuestions(templateId);
  };

  const handleAnswerChange = (variableName: string, value: string | number | boolean | null) => {
    setAnswers(prev => ({ ...prev, [variableName]: value }));
  };

  const handleFillWithExamples = () => {
    const examples: Record<string, string | number | boolean | null> = {};
    
    questions.forEach(question => {
      // Only fill if the field is currently empty
      if (question.example && (!answers[question.key] || answers[question.key] === '')) {
        // Convert example value based on data type
        if (question.dtype === 'number' || question.dtype === 'int' || question.dtype === 'float') {
          examples[question.key] = Number(question.example);
        } else if (question.dtype === 'boolean') {
          examples[question.key] = question.example.toLowerCase() === 'true' || question.example.toLowerCase() === 'yes';
        } else {
          examples[question.key] = question.example;
        }
      }
    });
    
    setAnswers(prev => ({ ...prev, ...examples }));
  };

  const handleClearPrefilled = (fieldKey: string) => {
    setAnswers(prev => ({ ...prev, [fieldKey]: '' }));
    setPrefilledFields(prev => {
      const updated = { ...prev };
      delete updated[fieldKey];
      return updated;
    });
  };

  const handleClearAllPrefilled = () => {
    const clearedAnswers = { ...answers };
    Object.keys(prefilledFields).forEach(key => {
      clearedAnswers[key] = '';
    });
    setAnswers(clearedAnswers);
    setPrefilledFields({});
  };

  const handleGenerateDraft = async () => {
    if (!selectedTemplateId) return;

    setError(null);
    setIsLoading(true);
    
    // Add user message showing they're generating
    addMessage('user', 'Please generate my document with the provided answers.');
    addMessage('assistant', 'Generating your document...');

    try {
      const result = await generateDraft(selectedTemplateId, answers, userQuery);
      setDraft(result);
      
      addMessage('assistant', 'Your document is ready! Here it is:', {
        draft: result
      }, true);
      
      // Switch to document tab
      setActiveTab('document');
    } catch (err) {
      const error = err as Error;
      addMessage('assistant', `I encountered an error: ${error.message || 'Failed to generate draft'}. Please try again.`, undefined, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    createNewChat();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showCommands) {
        // If commands are showing, select the first one
        const filteredCommands = commands.filter(cmd => 
          cmd.command.toLowerCase().includes(commandFilter.toLowerCase())
        );
        if (filteredCommands.length > 0) {
          filteredCommands[0].action();
        }
      } else {
        handleStartMatching();
      }
    } else if (e.key === 'Escape') {
      setShowCommands(false);
      setCommandFilter('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUserQuery(value);
    
    // Check for slash commands
    if (value === '/' || value.startsWith('/')) {
      setShowCommands(true);
      setCommandFilter(value.slice(1)); // Remove the slash
    } else {
      setShowCommands(false);
      setCommandFilter('');
    }
  };

  const handleInputFocus = () => {
    // Only show commands if user manually typed /
    if (userQuery.startsWith('/')) {
      setShowCommands(true);
      setCommandFilter(userQuery.slice(1));
    }
  };

  const handleDownload = async (format: 'md' | 'pdf' | 'docx' = 'md') => {
    if (!draft) return;
    
    const fileName = draft.template_title.replace(/\s+/g, '_');
    
    if (format === 'md') {
    const blob = new Blob([draft.draft_md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
      a.download = `${fileName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      // Generate PDF using jsPDF with HTML conversion
      const doc = new jsPDF();
      
      // Convert markdown to HTML first
      const htmlContent = convertMarkdownToHtml(draft.draft_md);
      
      // Create a temporary div to render the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '800px';
      document.body.appendChild(tempDiv);
      
      // Use html2canvas to convert HTML to canvas, then to PDF
      const canvas = await html2canvas(tempDiv, {
        width: 800,
        height: tempDiv.scrollHeight,
        scale: 2
      });
      
      document.body.removeChild(tempDiv);
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      doc.save(`${fileName}.pdf`);
    } else if (format === 'docx') {
      // Generate DOCX using docx library with proper table support
      const paragraphs = convertMarkdownToDocx(draft.draft_md);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });
      
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    }
  };

  // Helper function to convert markdown to HTML
  const convertMarkdownToHtml = (markdown: string): string => {
    let html = markdown
      // Convert headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Convert bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Convert lists
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      // Convert line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    // Convert markdown tables to HTML tables
    html = html.replace(/\|(.+)\|\s*\n\|[-\s|]+\|\s*\n((?:\|.+\|\s*\n?)*)/g, (match, header, rows) => {
      const headerCells = header.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
      const rowLines = rows.trim().split('\n').filter((line: string) => line.trim());
      
      let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
      
      // Header
      tableHtml += '<thead><tr>';
      headerCells.forEach((cell: string) => {
        tableHtml += `<th style="border: 1px solid #ccc; padding: 8px; background-color: #f5f5f5; text-align: left;">${cell}</th>`;
      });
      tableHtml += '</tr></thead>';
      
      // Rows
      tableHtml += '<tbody>';
      rowLines.forEach((line: string) => {
        const cells = line.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
        tableHtml += '<tr>';
        cells.forEach((cell: string) => {
          tableHtml += `<td style="border: 1px solid #ccc; padding: 8px;">${cell}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      
      return tableHtml;
    });
    
    // Wrap in paragraphs
    html = `<p>${html}</p>`;
    
    return html;
  };

  // Helper function to convert markdown to DOCX elements
  const convertMarkdownToDocx = (markdown: string): Paragraph[] => {
    const lines = markdown.split('\n');
    const elements: Paragraph[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#')) {
        // Headers
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '');
        elements.push(new Paragraph({
          children: [new TextRun({ text, bold: true, size: 32 - (level * 4) })],
          spacing: { after: 200 }
        }));
      } else if (line.startsWith('|') && line.includes('|')) {
        // Table row - collect all table rows
        const tableRows: string[][] = [];
        let j = i;
        
        while (j < lines.length && lines[j].trim().startsWith('|')) {
          const cells = lines[j].split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.length > 0) {
            tableRows.push(cells);
          }
          j++;
        }
        
        if (tableRows.length > 1) {
          // Add table as a special element (simplified for now)
          elements.push(new Paragraph({
            children: [new TextRun({ text: `Table with ${tableRows.length} rows`, bold: true })],
            spacing: { after: 200 }
          }));
          
          // Add each row as a paragraph for now
          tableRows.forEach(row => {
            elements.push(new Paragraph({
              children: [new TextRun({ text: row.join(' | ') })],
              spacing: { after: 100 }
            }));
          });
        }
        
        i = j - 1; // Skip processed lines
      } else if (line.startsWith('*') || /^\d+\./.test(line)) {
        // List items
        elements.push(new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 100 }
        }));
      } else if (line) {
        // Regular paragraph
        elements.push(new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 200 }
        }));
      }
    }
    
    return elements;
  };

  return (
    <div className="fixed inset-0 top-16 flex bg-gray-900 overflow-hidden">
      {/* Left Sidebar */}
      <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ${showHistory ? 'w-80' : 'w-16'}`}>
        <div className="p-4 flex-shrink-0">
          <div className="flex flex-col justify-between mb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title={showHistory ? "Hide History" : "Show History"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={handleReset}
              className="w-full flex p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Create A New Draft"
            >
              <Plus className="w-5 h-5" />
            </button>
      </div>

          {showHistory && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Chat History</h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {chatHistory.map((chat) => (
          <button
                    key={chat.id}
                    onClick={() => switchToChat(chat.id)}
                    className={`w-full text-left p-2 rounded-lg transition-colors ${
                      currentChatId === chat.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <div className="text-sm font-medium break-words leading-tight">{chat.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {chat.updatedAt.toLocaleDateString()} {chat.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
          </button>
                ))}
                {chatHistory.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-4">
                    No chat history yet
        </div>
      )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ${showSidebar ? 'mr-[38rem]' : ''}`}>
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-900 flex items-center justify-center">
                <Bot className="w-8 h-8 text-blue-400" />
        </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Welcome to Legal Document Assistant
              </h2>
              <p className="text-gray-300 mb-6">
                Describe the legal document you need and I&apos;ll help you create it step by step.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <h3 className="font-medium text-white mb-2">Contract Templates</h3>
                  <p className="text-sm text-gray-300">NDAs, employment agreements, service contracts</p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <h3 className="font-medium text-white mb-2">Legal Documents</h3>
                  <p className="text-sm text-gray-300">Terms of service, privacy policies, legal notices</p>
                </div>
              </div>
        </div>
      )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-3xl px-4 py-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-white border border-gray-700'
                }`}
              >
                <div className="prose prose-sm max-w-none">
                  {message.type === 'assistant' && message.content.includes('Searching for matching templates') ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span>{message.content}</span>
                    </div>
                  ) : message.type === 'assistant' && message.content.includes('Generating your document') ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span>{message.content}</span>
          </div>
                  ) : (
                <div>
                      <div className="m-0 mb-2 whitespace-pre-line">{message.content}</div>
                      
                      {/* Template Selection */}
                      {message.metadata?.templateMatches && (
                        <div className="space-y-3 mt-4">
                          {message.metadata.templateMatches.map((template, index) => (
                            <div
                              key={template.template_id}
                              onClick={() => handleSelectTemplate(template.template_id)}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                index === 0 
                                  ? 'border-2 border-blue-400 bg-blue-900 hover:bg-blue-800' 
                                  : 'border border-gray-600 hover:bg-gray-700'
                              }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                                  <h4 className="font-semibold text-white">{template.title}</h4>
                                  {template.doc_type && (
                                    <p className="text-sm text-gray-300 mt-1">
                                      Type: {template.doc_type}
                    </p>
                  )}
                                  {template.jurisdiction && (
                                    <p className="text-sm text-gray-300">
                                      Jurisdiction: {template.jurisdiction}
                    </p>
                  )}
                </div>
                <div className="text-right">
                                  <div className={`font-bold ${index === 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                                    {Math.round(template.confidence * 100)}%
                  </div>
                                  <div className="text-xs text-gray-400">Confidence</div>
                </div>
              </div>
            </div>
                ))}
          </div>
                      )}

                      {/* Questions */}
                      {message.metadata?.questions && (
                        <div className="mt-4 p-4 bg-blue-900 border border-blue-700 rounded-lg">
                          <p className="text-blue-200 text-sm">
                            📝 <strong>Form opened in sidebar!</strong> Please fill out the variables in the right panel to generate your document.
                          </p>
                        </div>
                      )}

                      {/* Draft Result */}
                      {message.metadata?.draft && (
                        <div className="mt-4 p-4 bg-green-900 border border-green-700 rounded-lg">
                          <p className="text-green-200 text-sm">
                            ✅ <strong>Document generated!</strong> Your document is ready and available in the Document tab on the right.
                          </p>
                      </div>
          )}
                        </div>
      )}
                      </div>
                    </div>

              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
                  </div>
                ))}

            <div ref={messagesEndRef} />
              </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="flex items-center gap-2">
                <textarea
                  ref={inputRef}
                  value={userQuery}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onFocus={handleInputFocus}
                  placeholder="I need a non-disclosure agreement for a software development project in Nodia... (or type / for commands)"
                  className="w-full px-4 py-3 pr-12 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-gray-700 text-white placeholder-gray-400"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleStartMatching()}
                  disabled={!userQuery.trim() || isLoading}
                  className="p-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              {/* Command Dropdown */}
              {showCommands && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                  {commands
                    .filter(cmd => 
                      cmd.command.toLowerCase().includes(commandFilter.toLowerCase())
                    )
                    .map((cmd) => (
          <button
                        key={cmd.command}
                        onClick={() => cmd.action()}
                        className="w-full px-4 py-3 text-left hover:bg-gray-600 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        <div className="flex items-center gap-3">
                          <code className="text-blue-400 font-mono text-sm">{cmd.command}</code>
                          <span className="text-gray-300 text-sm">{cmd.description}</span>
                        </div>
          </button>
                    ))}
                  {commands.filter(cmd => 
                    cmd.command.toLowerCase().includes(commandFilter.toLowerCase())
                  ).length === 0 && (
                    <div className="px-4 py-3 text-gray-400 text-sm">
                      No commands found
            </div>
          )}
        </div>
      )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border-t border-red-700 px-4 py-3 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center gap-3 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - ChatGPT-like Canvas */}
      {showSidebar && (
        <div className="fixed right-0 top-16 bottom-0 w-[38rem] bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ease-in-out">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-700">
          <button
              onClick={() => setActiveTab('variables')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'variables'
                  ? 'bg-gray-700 text-white border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Variables
              <span className="ml-2 text-xs text-gray-400">
                ({Object.keys(answers).filter(key => answers[key] !== null && answers[key] !== undefined && answers[key] !== '').length}/{questions.length} done)
              </span>
          </button>
            <button
              onClick={() => setActiveTab('document')}
              disabled={!draft}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'document'
                  ? 'bg-gray-700 text-white border-b-2 border-blue-400'
                  : draft
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              Document
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'variables' && (
              <div className="p-4" id="variables-form">
                <h3 className="text-lg font-semibold text-white mb-4">Document Variables</h3>
                
                {/* Prefilled Summary */}
                {Object.keys(prefilledFields).length > 0 && (
                  <div className="mb-6 p-4 bg-green-900 border border-green-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-green-300 text-sm">
                          🎉 <strong>{Object.keys(prefilledFields).length} fields</strong> were automatically filled from your query!
                        </span>
                      </div>
                      <button
                        onClick={handleClearAllPrefilled}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
                
                {questions.length > 0 ? (
                  questions.map((question, index) => {
                    const isPrefilled = prefilledFields[question.key] !== undefined;
                    return (
                      <div key={question.key} className={`mb-4 ${isPrefilled ? 'border-l-4 border-green-500 pl-4' : ''}`}>
                        <label className="block text-sm font-medium text-white mb-2">
                          {index + 1}. {question.question}
                          {question.required && <span className="text-red-400 ml-1">*</span>}
                          {isPrefilled && (
                            <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                              ✓ Pre-filled
                            </span>
                    )}
                  </label>
                  
                        {question.description && (
                          <p className="text-xs text-gray-400 mb-2">{question.description}</p>
                        )}
                        
                        <div className="flex gap-2">
                          {question.enum_values && question.enum_values.length > 0 ? (
                    <select
                              value={String(answers[question.key] || '')}
                              onChange={(e) => handleAnswerChange(question.key, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            >
                              <option value="">Select an option...</option>
                              {question.enum_values.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                              type={question.dtype === 'number' || question.dtype === 'int' || question.dtype === 'float' ? 'number' : 'text'}
                              value={String(answers[question.key] || '')}
                      onChange={(e) =>
                                handleAnswerChange(
                                  question.key, 
                                  question.dtype === 'number' || question.dtype === 'int' || question.dtype === 'float' 
                                    ? Number(e.target.value) 
                                    : e.target.value
                                )
                              }
                              className={`flex-1 px-3 py-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent ${
                                question.dtype === 'number' || question.dtype === 'int' || question.dtype === 'float' 
                                  ? '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' 
                                  : ''
                              }`}
                              placeholder={question.example ? `e.g., ${question.example}` : "Enter your answer..."}
                              pattern={question.regex || undefined}
                              onWheel={(e) => {
                                if (question.dtype === 'number' || question.dtype === 'int' || question.dtype === 'float') {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          )}
                          {isPrefilled && (
            <button
                              onClick={() => handleClearPrefilled(question.key)}
                              className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                              title="Clear prefilled value"
            >
                              Clear
            </button>
                          )}
          </div>
        </div>
                    );
                  })
                ) : (
                  <p className="text-gray-400 text-center py-8">No variables needed. Please view the document.</p>
                )}
                
                {questions.length > 0 && (
                  <>
                    <button
                      onClick={handleFillWithExamples}
                      className="w-full mt-4 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      ✨ Fill in with examples
                    </button>
            <button
              onClick={handleGenerateDraft}
                      disabled={isLoading}
                      className="w-full mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                      {isLoading ? 'Generating...' : 'Generate Document'}
            </button>
                  </>
                )}
            </div>
          )}

            {activeTab === 'document' && draft && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Generated Document</h3>
                  <div className="flex gap-2">
              <button
                      onClick={() => handleDownload('md')}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                      MD
                    </button>
                    <button
                      onClick={() => handleDownload('pdf')}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
              <button
                      onClick={() => handleDownload('docx')}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                      DOCX
              </button>
            </div>
            </div>
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <div className="prose prose-invert prose-lg max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">{children}</h1>,
                        h2: ({children}) => <h2 className="text-xl font-bold text-white mb-3 mt-5">{children}</h2>,
                        h3: ({children}) => <h3 className="text-lg font-bold text-white mb-2 mt-4">{children}</h3>,
                        p: ({children}) => <p className="text-gray-200 mb-3 leading-relaxed">{children}</p>,
                        ul: ({children}) => <ul className="list-disc list-inside text-gray-200 mb-3 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside text-gray-200 mb-3 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="text-gray-200">{children}</li>,
                        strong: ({children}) => <strong className="font-bold text-white">{children}</strong>,
                        em: ({children}) => <em className="italic text-gray-300">{children}</em>,
                        code: ({children}) => <code className="bg-gray-800 text-blue-300 px-1 py-0.5 rounded text-sm">{children}</code>,
                        pre: ({children}) => <pre className="bg-gray-800 text-gray-200 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-300 mb-4">{children}</blockquote>,
                        table: ({children}) => (
                          <div className="overflow-x-auto mb-4">
                            <table className="w-full border-collapse border border-gray-600 min-w-full">{children}</table>
          </div>
                        ),
                        thead: ({children}) => <thead className="bg-gray-800">{children}</thead>,
                        tbody: ({children}) => <tbody>{children}</tbody>,
                        tr: ({children}) => <tr className="border-b border-gray-600">{children}</tr>,
                        th: ({children}) => <th className="border border-gray-600 bg-gray-800 text-white px-3 py-2 text-left font-semibold">{children}</th>,
                        td: ({children}) => <td className="border border-gray-600 text-gray-200 px-3 py-2">{children}</td>,
                      }}
                    >
                      {draft.draft_md}
                    </ReactMarkdown>
                  </div>
          </div>
        </div>
      )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

