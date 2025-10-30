'use client';

import { useState, useEffect } from 'react';
import { Search, Trash2, FileText, AlertCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getTemplates, getTemplate, deleteTemplate } from '@/lib/api';
import type { TemplateListItem, TemplateDetail } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast from '@/components/Toast';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [clickedTemplateId, setClickedTemplateId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTemplates(templates);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = templates.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.doc_type?.toLowerCase().includes(query) ||
          t.jurisdiction?.toLowerCase().includes(query) ||
          t.similarity_tags?.some((tag) => tag.toLowerCase().includes(query))
      );
      setFilteredTemplates(filtered);
    }
  }, [searchQuery, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTemplates();
      setTemplates(data.templates);
      setFilteredTemplates(data.templates);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    setClickedTemplateId(templateId);
    setLoadingDetail(true);
    try {
      const template = await getTemplate(templateId);
      setSelectedTemplate(template);
    } catch (err) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to load template details', type: 'error' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await deleteTemplate(templateId);
      setToast({ message: 'Template deleted successfully', type: 'success' });
      setSelectedTemplate(null);
      setClickedTemplateId(null);
      fetchTemplates();
    } catch (err) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to delete template', type: 'error' });
    }
  };

  const handleDownloadTemplate = (template: TemplateDetail) => {
    const content = JSON.stringify(template, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUseTemplate = (templateId: string) => {
    router.push(`/chat?templateId=${templateId}&mode=template_selection`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Templates
        </h1>
        <p className="text-gray-300">
          Browse and manage your document templates
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, type, jurisdiction, or tags..."
          className="w-full pl-10 pr-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-gray-700 text-white placeholder-gray-400"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="bg-gray-800 rounded-lg shadow-md p-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-300 mt-4">Loading templates...</p>
            </div>
          ) : error ? (
            <div className="bg-gray-800 rounded-lg shadow-md p-8">
              <div className="flex items-center gap-3 text-red-300">
                <AlertCircle className="w-6 h-6" />
                <p>{error}</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">
                {searchQuery
                  ? 'No templates found matching your search'
                  : 'No templates available. Upload a document to create one.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.template_id}
                  onClick={() => handleSelectTemplate(template.template_id)}
                  className={`bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg hover:border-blue-300 border-2 ${
                    clickedTemplateId === template.template_id
                      ? 'border-blue-400'
                      : 'border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {template.title}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {template.doc_type && (
                          <span className="px-2 py-1 text-xs font-medium text-blue-400 bg-blue-900 rounded">
                            {template.doc_type}
                          </span>
                        )}
                        {template.jurisdiction && (
                          <span className="px-2 py-1 text-xs font-medium text-green-400 bg-green-900 rounded">
                            {template.jurisdiction}
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 rounded">
                          {template.variables.length} variables
                        </span>
                      </div>
                      {template.similarity_tags && template.similarity_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.similarity_tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs text-gray-300 bg-gray-700 border border-gray-600 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <FileText className="w-8 h-8 text-gray-400 flex-shrink-0 ml-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Detail Panel */}
        <div className="lg:col-span-1">
          {loadingDetail ? (
            <div className="bg-gray-800 rounded-lg shadow-md p-8">
              <LoadingSpinner size="md" />
              <p className="text-center text-gray-300 mt-4 text-sm">Loading details...</p>
            </div>
          ) : selectedTemplate ? (
            <div className="bg-gray-800 rounded-lg shadow-md p-6 sticky top-24">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Template Details
                </h3>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-300 uppercase">Title</label>
                  <p className="text-white mt-1">{selectedTemplate.title}</p>
                </div>

                {selectedTemplate.doc_type && (
                  <div>
                    <label className="text-xs font-medium text-gray-300 uppercase">Document Type</label>
                    <p className="text-white mt-1">{selectedTemplate.doc_type}</p>
                  </div>
                )}

                {selectedTemplate.jurisdiction && (
                  <div>
                    <label className="text-xs font-medium text-gray-300 uppercase">Jurisdiction</label>
                    <p className="text-white mt-1">{selectedTemplate.jurisdiction}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-300 uppercase mb-2 block">
                    Variables ({selectedTemplate.variables.length})
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedTemplate.variables.map((variable, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-700 rounded border border-gray-600"
                      >
                        <p className="font-medium text-sm text-white">{variable.label || variable.key}</p>
                        <p className="text-xs text-gray-300 mt-1">{variable.dtype}</p>
                        {variable.description && (
                          <p className="text-xs text-gray-400 mt-1">{variable.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTemplate.similarity_tags && selectedTemplate.similarity_tags.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-300 uppercase mb-2 block">Tags</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.similarity_tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs text-gray-300 bg-gray-700 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTemplate.created_at && (
                  <div>
                    <label className="text-xs font-medium text-gray-300 uppercase">Created</label>
                    <p className="text-white text-sm mt-1">
                      {new Date(selectedTemplate.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => handleUseTemplate(selectedTemplate.template_id)}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Use Template
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg shadow-md p-8 text-center sticky top-24">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">
                Select a template to view details
              </p>
            </div>
          )}
        </div>
      </div>

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

