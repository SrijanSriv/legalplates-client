'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, MessageSquare, FolderOpen, Zap, Shield, Clock, Send, X } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'chat' | 'upload' | 'draft'>('chat');
  const [userQuery, setUserQuery] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Commands for slash command system
  const commands = useMemo(() => [
    {
      command: '/draft',
      description: 'Create a new document draft',
      action: () => {
        setUserQuery('');
        setShowCommands(false);
        setCommandFilter('');
        setInputMode('draft');
      }
    },
    {
      command: '/upload',
      description: 'Go to upload page',
      action: () => {
        router.push('/upload');
      }
    }
  ], [router]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && inputMode === 'chat') {
      e.preventDefault();
      if (showCommands) {
        const filteredCommands = commands.filter(cmd => 
          cmd.command.toLowerCase().includes(commandFilter.toLowerCase())
        );
        if (filteredCommands.length > 0) {
          filteredCommands[0].action();
        }
      } else if (userQuery.trim()) {
        handleChatSubmit();
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
      setCommandFilter(value.slice(1));
      
      // Auto-detect /upload and /draft commands
      if (value.trim() === '/upload') {
        router.push('/upload');
        setUserQuery('');
        setShowCommands(false);
        setCommandFilter('');
      } else if (value.trim() === '/draft') {
        setInputMode('draft');
        setUserQuery('');
        setShowCommands(false);
        setCommandFilter('');
      }
    } else {
      setShowCommands(false);
      setCommandFilter('');
    }
  };

  const handleChatSubmit = () => {
    if (userQuery.trim()) {
      const query = userQuery;
      setUserQuery(''); // Clear the input before navigation
      router.push(`/chat?query=${encodeURIComponent(query)}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = () => {
    if (selectedFile) {
      router.push('/upload');
    }
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Global slash key handler
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
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

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered',
      description: 'Smart template matching and document generation',
      color: 'text-yellow-400 bg-yellow-900',
    },
    {
      icon: Shield,
      title: 'Secure',
      description: 'Enterprise-grade security for your legal documents',
      color: 'text-green-400 bg-green-900',
    },
    {
      icon: Clock,
      title: 'Fast',
      description: 'Generate documents in seconds, not hours',
      color: 'text-blue-400 bg-blue-900',
    },
  ];

  const actionCards = [
    {
      href: '/upload',
      icon: Upload,
      title: 'Upload Document',
      description: 'Upload a PDF or DOCX to extract variables and create templates',
      color: 'bg-blue-900 hover:bg-blue-800 border-blue-700',
      iconColor: 'text-blue-400',
    },
    {
      href: '/chat',
      icon: MessageSquare,
      title: 'Draft Document',
      description: 'Use AI to match templates and generate custom documents',
      color: 'bg-green-900 hover:bg-green-800 border-green-700',
      iconColor: 'text-green-400',
    },
    {
      href: '/templates',
      icon: FolderOpen,
      title: 'Browse Templates',
      description: 'View and manage your document templates',
      color: 'bg-purple-900 hover:bg-purple-800 border-purple-700',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="flex flex-col gap-40" >
        <div className="text-center mb-6 mt-30">
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to LegalPlates
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            AI-powered legal document management and drafting system
          </p>
        </div>

        {/* Chat Input / Upload Section */}
        <div className="mt-1">
          {inputMode === 'chat' ? (
            <div className="relative max-w-3xl mx-auto">
              <div className="flex items-center gap-2">
                <textarea
                  ref={inputRef}
                  value={userQuery}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your document request... (or press / for commands)"
                  className="w-full px-4 py-3 pr-12 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-gray-800 text-white placeholder-gray-400"
                  rows={1}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!userQuery.trim()}
                  className="p-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              {/* Command Dropdown */}
              {showCommands && (
                <div className="absolute bottom-full left-0 right-20 mb-2 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
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
                </div>
              )}
            </div>
          ) : inputMode === 'draft' ? (
            <div className="relative max-w-3xl mx-auto">
              <div className="flex items-center gap-2">
                <textarea
                  ref={inputRef}
                  value={userQuery}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your document..."
                  className="w-full px-4 py-3 pr-12 border-2 border-green-500 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 resize-none bg-gray-800 text-white placeholder-gray-400"
                  rows={1}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!userQuery.trim()}
                  className="p-3.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 bg-gray-800">
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Upload className="w-5 h-5 text-blue-400" />
                      <span className="text-white">{selectedFile.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFileUpload}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Upload
                      </button>
                      <button
                        onClick={handleFileRemove}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-300 mb-2">Drop your file here or click to browse</p>
                    <p className="text-gray-500 text-sm mb-4">Supported formats: PDF, DOCX</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Select File
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className={`block p-6 rounded-lg border-2 transition-all ${card.color}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${card.iconColor} bg-gray-700`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {card.title}
                    </h3>
                    <p className="text-gray-300 text-sm">{card.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </div>

      {/* Features */}
      <div className="bg-gray-800 rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="text-center">
                <div className={`inline-flex p-4 rounded-full ${feature.color} mb-4`}>
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="mt-12 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-lg p-8 border border-blue-700">
        <h2 className="text-2xl font-bold text-white mb-4">
          Quick Start Guide
        </h2>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-400 text-white text-sm font-bold flex items-center justify-center">
              1
            </span>
            <span className="text-gray-300">
              <strong>Upload a document</strong> to extract variables and create a template
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-400 text-white text-sm font-bold flex items-center justify-center">
              2
            </span>
            <span className="text-gray-300">
              <strong>Use the chat interface</strong> to describe the document you need
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-400 text-white text-sm font-bold flex items-center justify-center">
              3
            </span>
            <span className="text-gray-300">
              <strong>Answer the AI-generated questions</strong> to fill in template variables
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-400 text-white text-sm font-bold flex items-center justify-center">
              4
            </span>
            <span className="text-gray-300">
              <strong>Generate your document</strong> and download it
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
