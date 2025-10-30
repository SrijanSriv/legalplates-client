import axios from 'axios';
import type {
  APIResponse,
  UploadResponseBody,
  TemplateListResponseBody,
  TemplateDetail,
  TemplateDeleteResponseBody,
  TemplateMatchResponseBody,
  QuestionResponseBody,
  GenerateDraftResponseBody,
  TemplateMatchRequest,
  QuestionRequest,
  GenerateDraftRequest,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to handle and validate API responses with proper type casting
async function handleResponse<T>(response: import('axios').AxiosResponse<APIResponse<T>>): Promise<T> {
  const data = response.data;
  
  // Validate the response structure
  if (data.error) {
    throw new Error(data.message || 'API returned an error');
  }
  
  if (data.body === null) {
    throw new Error('API returned null body');
  }
  
  // Return the unwrapped body with proper type
  return data.body as T;
}

// ============================================================================
// UPLOAD ENDPOINTS
// ============================================================================

/**
 * Upload a document to create a new template
 */
export async function uploadDocument(file: File): Promise<UploadResponseBody> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/api/v1/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return handleResponse<UploadResponseBody>(response);
}

// ============================================================================
// TEMPLATE ENDPOINTS
// ============================================================================

/**
 * Get list of all templates with pagination
 */
export async function getTemplates(
  skip: number = 0,
  limit: number = 100
): Promise<TemplateListResponseBody> {
  const response = await apiClient.get(`/api/v1/template?skip=${skip}&limit=${limit}`);
  
  return handleResponse<TemplateListResponseBody>(response);
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(templateId: string): Promise<TemplateDetail> {
  const response = await apiClient.get(`/api/v1/template/${templateId}`);
  
  return handleResponse<TemplateDetail>(response);
}

/**
 * Delete a template by ID
 */
export async function deleteTemplate(templateId: string): Promise<TemplateDeleteResponseBody> {
  const response = await apiClient.delete(`/api/v1/template/${templateId}`);
  
  return handleResponse<TemplateDeleteResponseBody>(response);
}

// ============================================================================
// DRAFT ENDPOINTS
// ============================================================================

/**
 * Match a user query to find the best template
 */
export async function matchTemplate(query: string): Promise<TemplateMatchResponseBody> {
  const requestBody: TemplateMatchRequest = {
    user_query: query,
  };

  const response = await apiClient.post('/api/v1/draft/match', requestBody);
  
  return handleResponse<TemplateMatchResponseBody>(response);
}

/**
 * SSE types for real-time status updates
 */
export interface SSEStatusUpdate {
  status: 'searching' | 'searching_web' | 'success' | 'error' | 'no_templates';
  message: string;
  data?: TemplateMatchResponseBody;
}

/**
 * Match template with real-time SSE status updates
 */
export function matchTemplateStream(
  query: string,
  onStatusUpdate: (update: SSEStatusUpdate) => void,
  onError: (error: Error) => void
): (() => void) {
  const requestBody: TemplateMatchRequest = {
    user_query: query,
  };

  let canceled = false;

  // Use fetch with streaming (browser-compatible)
  fetch(`${API_URL}/api/v1/draft/match-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (!canceled) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onStatusUpdate(data);
              
              // Close if terminal status
              if (data.status === 'success' || data.status === 'error' || data.status === 'no_templates') {
                reader.cancel();
                return;
              }
            } catch (err) {
              console.error('Error parsing SSE data:', err);
              onError(new Error('Failed to parse server response'));
              reader.cancel();
              return;
            }
          }
        }
      }
    })
    .catch((error) => {
      if (!canceled) {
        console.error('SSE connection error:', error);
        onError(error instanceof Error ? error : new Error('Connection failed'));
      }
    });

  // Return cleanup function
  return () => {
    canceled = true;
  };
}

/**
 * Generate questions for a template
 */
export async function getQuestions(
  templateId: string,
  userQuery?: string
): Promise<QuestionResponseBody> {
  const requestBody: QuestionRequest = {
    template_id: templateId,
    user_query: userQuery || null,
  };

  const response = await apiClient.post('/api/v1/draft/questions', requestBody);
  
  return handleResponse<QuestionResponseBody>(response);
}

/**
 * Generate a draft document from a template and answers
 */
export async function generateDraft(
  templateId: string,
  answers: Record<string, string | number | boolean | null>,
  userQuery?: string
): Promise<GenerateDraftResponseBody> {
  const requestBody: GenerateDraftRequest = {
    template_id: templateId,
    answers,
    user_query: userQuery,
  };

  const response = await apiClient.post('/api/v1/draft/generate', requestBody);
  
  return handleResponse<GenerateDraftResponseBody>(response);
}

// ============================================================================
// LEGACY TYPE EXPORTS (for backward compatibility)
// ============================================================================
// Re-export commonly used types for convenience
export type {
  VariableSchema as Variable,
  TemplateListItem as Template,
  TemplateMatch,
  Question,
} from './types';
