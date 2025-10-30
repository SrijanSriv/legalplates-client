'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { uploadDocument } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { UploadResponseBody } from '@/lib/types';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponseBody | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      return 'Please upload a PDF or DOCX file';
    }
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setResult(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
      } else {
        setFile(droppedFile);
      }
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
      } else {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const data = await uploadDocument(file);
      setResult(data);
      setFile(null);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleUseTemplate = () => {
    if (result?.template?.template_id) {
      router.push(`/chat?templateId=${result.template.template_id}&mode=template_selection`);
    }
  };

  // Convert snake_case to readable text
  const formatVariableName = (name: string): string => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Upload Document
        </h1>
        <p className="text-gray-300">
          Upload a legal document to extract variables and create a template
        </p>
      </div>

      {/* Upload Area */}
      {!result && (
        <div className="bg-gray-800 rounded-lg shadow-md p-8">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-900'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Drop your file here or click to browse
            </h3>
            <p className="text-gray-300 mb-4">
              Supports PDF and DOCX files up to 10MB
            </p>
            <input
              type="file"
              id="file-input"
              accept=".pdf,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Choose File
            </label>
          </div>

          {/* Selected File */}
          {file && !loading && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-sm text-gray-300">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleUpload}
                className="mt-4 w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Upload and Process
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="mt-6 p-8 bg-blue-900 rounded-lg border border-blue-700">
              <LoadingSpinner size="lg" />
              <p className="text-center text-white mt-4 font-medium">
                Processing document and extracting variables...
              </p>
              <p className="text-center text-gray-300 text-sm mt-2">
                This may take a moment. AI is analyzing your document.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6 flex items-center gap-3 text-red-300 bg-red-900 p-4 rounded-lg border border-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="space-y-6">
          {/* Success Message */}
          <div className="bg-green-900 border border-green-700 rounded-lg p-6">
            <div className="flex items-center gap-3 text-green-300 mb-2">
              <CheckCircle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Upload Successful!</h3>
            </div>
            <p className="text-green-200">
              Document processed and template created successfully.
            </p>
          </div>

          {/* Template Info */}
          <div className="bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              Template Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-300">Document Name:</label>
                <p className="text-white">{result.document_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Template Title:</label>
                <p className="text-white">{result.template.title}</p>
              </div>
              {result.template.doc_type && (
                <div>
                  <label className="text-sm font-medium text-gray-300">Document Type:</label>
                  <p className="text-white">{result.template.doc_type}</p>
                </div>
              )}
              {result.template.jurisdiction && (
                <div>
                  <label className="text-sm font-medium text-gray-300">Jurisdiction:</label>
                  <p className="text-white">{result.template.jurisdiction}</p>
                </div>
              )}
            </div>
          </div>

          {/* Questions/Variables */}
          <div className="bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                Extracted Variables ({result.questions?.length || 0})
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Upload Another Document
                </button>
                <button
                  onClick={handleUseTemplate}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Use this as template
                </button>
              </div>
            </div>
            {result.questions && result.questions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.questions.map((question, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-700 rounded-lg border border-gray-600"
                  >
                    <p className="font-medium text-white mb-1">{formatVariableName(question.key)}</p>
                    <p className="text-sm text-gray-300 mb-2">{question.dtype}</p>
                    {question.description && (
                      <p className="text-sm text-gray-400 mb-2">{question.description}</p>
                    )}
                    {question.example && (
                      <p className="text-xs text-gray-500 mb-2">Example: {question.example}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-300">No variables extracted from this document.</p>
            )}
          </div>
          <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                Extracted Variables ({result.questions?.length || 0})
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Upload Another Document
                </button>
                <button
                  onClick={handleUseTemplate}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Use this as template
                </button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

