'use client';

import { useState } from 'react';
import { Send, AlertCircle, CheckCircle, Download, ArrowLeft } from 'lucide-react';
import { matchTemplate, getQuestions, generateDraft } from '@/lib/api';
import type { 
  TemplateMatch, 
  Question, 
  GenerateDraftResponseBody 
} from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';

type Step = 'input' | 'matching' | 'select-template' | 'questions' | 'generating' | 'result';

export default function ChatPage() {
  const [step, setStep] = useState<Step>('input');
  const [userQuery, setUserQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Template matching state
  const [topMatch, setTopMatch] = useState<TemplateMatch | null>(null);
  const [alternatives, setAlternatives] = useState<TemplateMatch[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | null>>({});
  
  // Draft state
  const [draft, setDraft] = useState<GenerateDraftResponseBody | null>(null);

  const handleStartMatching = async () => {
    if (!userQuery.trim()) {
      setError('Please enter a description');
      return;
    }

    setError(null);
    setStep('matching');

    try {
      const result = await matchTemplate(userQuery);
      
      if (!result.found || !result.top_match) {
        setError('No matching template found. Try uploading a document first or refining your query.');
        setStep('input');
        return;
      }

      setTopMatch(result.top_match);
      setAlternatives(result.alternatives);
      
      if (result.alternatives.length > 0) {
        setStep('select-template');
      } else {
        // Auto-select if only one match
        setSelectedTemplateId(result.top_match.template_id);
        await handleGetQuestions(result.top_match.template_id);
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to match template');
      setStep('input');
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    await handleGetQuestions(templateId);
  };

  const handleGetQuestions = async (templateId: string) => {
    setError(null);
    setStep('questions');

    try {
      const result = await getQuestions(templateId, userQuery);
      setQuestions(result.questions);
      setAnswers(result.prefilled || {});
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to generate questions');
      setStep('input');
    }
  };

  const handleAnswerChange = (variableName: string, value: string | number | boolean | null) => {
    setAnswers(prev => ({ ...prev, [variableName]: value }));
  };

  const handleGenerateDraft = async () => {
    if (!selectedTemplateId) return;

    setError(null);
    setStep('generating');

    try {
      const result = await generateDraft(selectedTemplateId, answers, userQuery);
      setDraft(result);
      setStep('result');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to generate draft');
      setStep('questions');
    }
  };

  const handleReset = () => {
    setStep('input');
    setUserQuery('');
    setError(null);
    setTopMatch(null);
    setAlternatives([]);
    setSelectedTemplateId(null);
    setQuestions([]);
    setAnswers({});
    setDraft(null);
  };

  const handleDownload = () => {
    if (!draft) return;
    const blob = new Blob([draft.draft_md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.template_title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Draft Document
        </h1>
        <p className="text-gray-600">
          Describe the document you need and let AI help you draft it
        </p>
      </div>

      {/* Step 1: Initial Input */}
      {step === 'input' && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What document do you need?
          </label>
          <textarea
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="E.g., I need a non-disclosure agreement for a software development project in Noida..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-black placeholder-gray-400"
            rows={6}
          />
          <button
            onClick={handleStartMatching}
            className="mt-4 w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            Find Template
          </button>
        </div>
      )}

      {/* Step 2: Matching Templates */}
      {step === 'matching' && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <LoadingSpinner size="lg" />
          <p className="text-center text-gray-700 mt-4 font-medium">
            Searching for matching templates...
          </p>
          <p className="text-center text-gray-600 text-sm mt-2">
            AI is analyzing your query and finding the best template match
          </p>
        </div>
      )}

      {/* Step 3: Select Template */}
      {step === 'select-template' && topMatch && (
        <div className="space-y-6">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Top Match
            </h3>
            <div
              onClick={() => handleSelectTemplate(topMatch.template_id)}
              className="p-6 border-2 border-blue-500 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {topMatch.title}
                  </h4>
                  {topMatch.doc_type && (
                    <p className="text-sm text-gray-600 mt-1">
                      Type: {topMatch.doc_type}
                    </p>
                  )}
                  {topMatch.jurisdiction && (
                    <p className="text-sm text-gray-600">
                      Jurisdiction: {topMatch.jurisdiction}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(topMatch.confidence * 100)}%
                  </div>
                  <div className="text-xs text-gray-600">Confidence</div>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Use This Template
              </button>
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Alternative Templates
              </h3>
              <div className="space-y-4">
                {alternatives.map((alt) => (
                  <div
                    key={alt.template_id}
                    onClick={() => handleSelectTemplate(alt.template_id)}
                    className="p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{alt.title}</h4>
                        {alt.doc_type && (
                          <p className="text-sm text-gray-600 mt-1">
                            Type: {alt.doc_type}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-700">
                          {Math.round(alt.confidence * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">Confidence</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Questions */}
      {step === 'questions' && questions.length > 0 && (
        <div className="space-y-6">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Start Over
          </button>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Answer Questions
            </h3>
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {index + 1}. {question.question}
                    {question.required && (
                      <span className="text-red-600 ml-1">*</span>
                    )}
                  </label>
                  {question.description && (
                    <p className="text-sm text-gray-500 mb-2">{question.description}</p>
                  )}
                  {question.example && (
                    <p className="text-xs text-gray-400 mb-2">Example: {question.example}</p>
                  )}
                  
                  {question.dtype === 'boolean' ? (
                    <select
                      value={answers[question.key] !== undefined ? String(answers[question.key]) : ''}
                      onChange={(e) =>
                        handleAnswerChange(
                          question.key,
                          e.target.value === 'true'
                        )
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : question.enum_values && question.enum_values.length > 0 ? (
                    <select
                      value={String(answers[question.key] || '')}
                      onChange={(e) =>
                        handleAnswerChange(question.key, e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your answer..."
                      pattern={question.regex || undefined}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerateDraft}
              className="mt-8 w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Generate Document
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Generating Draft */}
      {step === 'generating' && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <LoadingSpinner size="lg" />
          <p className="text-center text-gray-700 mt-4 font-medium">
            Generating your document...
          </p>
          <p className="text-center text-gray-600 text-sm mt-2">
            AI is filling in the template with your answers
          </p>
        </div>
      )}

      {/* Step 6: Result */}
      {step === 'result' && draft && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 text-green-800 mb-2">
              <CheckCircle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Document Generated!</h3>
            </div>
            <p className="text-green-700">
              Your document is ready. Review it below and download when ready.
            </p>
          </div>

          {draft.has_missing_variables && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">Some variables are missing:</p>
              </div>
              <ul className="mt-2 ml-7 text-yellow-700 text-sm list-disc">
                {draft.missing_variables.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {draft.template_title}
              </h3>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
            
            <div className="prose max-w-none border-t border-gray-200 pt-6">
              <ReactMarkdown>{draft.draft_md}</ReactMarkdown>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Create Another Document
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-6 flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

