// Generated TypeScript types for LegalPlates API
// Auto-generated from Pydantic schemas

// ============================================================================
// BASE TYPES
// ============================================================================

export interface APIResponse<T = unknown> {
  error: boolean;
  message: string;
  body: T | null;
}

export interface PaginationMeta {
  total: number;
  skip: number;
  limit: number;
  returned: number;
}

// ============================================================================
// VARIABLE TYPES
// ============================================================================

export interface VariableSchema {
  key: string;
  label: string;
  description?: string | null;
  example?: string | null;
  required: boolean;
  dtype: string;
  regex?: string | null;
  enum_values?: string[] | null;
}

// ============================================================================
// UPLOAD TYPES
// ============================================================================

export interface UploadResponseBody {
  document_id: number;
  document_name: string;
  template: {
    template_id: string;
    title: string;
    doc_type?: string;
    jurisdiction?: string;
    file_description?: string;
  };
  questions: {
    key: string;
    question: string;
    description?: string;
    example?: string;
    required: boolean;
    dtype: string;
    regex?: string;
    enum_values?: string[];
  }[];
}

export interface DuplicateTemplateInfo {
  id: number;
  template_id: string;
  title: string;
  doc_type?: string | null;
  jurisdiction?: string | null;
  file_description?: string | null;
  similarity_score: number;
}

export interface DuplicateTemplateResponseBody {
  existing_template: DuplicateTemplateInfo;
}

export interface UploadResponse {
  error: boolean;
  message: string;
  body: UploadResponseBody | DuplicateTemplateResponseBody;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface TemplateBase {
  template_id: string;
  title: string;
  file_description?: string | null;
  doc_type?: string | null;
  jurisdiction?: string | null;
  similarity_tags: string[];
  created_at?: string | null;
}

export interface TemplateListItem extends TemplateBase {
  id: number;
  variables: VariableSchema[];
}

export interface TemplateDetail extends TemplateBase {
  body_md: string;
  template_metadata?: {
    test?: boolean;
    source?: string;
    web_url?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
  variables: VariableSchema[];
}

export interface TemplateListResponseBody {
  templates: TemplateListItem[];
  pagination: PaginationMeta;
}

export interface TemplateListResponse {
  error: false;
  message: string;
  body: TemplateListResponseBody;
}

export interface TemplateResponse {
  error: false;
  message: string;
  body: TemplateDetail;
}

export interface TemplateDeleteResponseBody {
  template_id: string;
  success: boolean;
}

export interface TemplateDeleteResponse {
  error: false;
  message: string;
  body: TemplateDeleteResponseBody;
}

// ============================================================================
// DRAFT TYPES
// ============================================================================

// Template Matching
export interface TemplateMatchRequest {
  user_query: string;
}

export interface TemplateMatch {
  template_id: string;
  title: string;
  confidence: number;
  explanation: string;
  doc_type?: string | null;
  jurisdiction?: string | null;
  semantic_similarity?: number | null;
  source: string;
  web_url?: string | null;
}

export interface TemplateMatchResponseBody {
  top_match?: TemplateMatch | null;
  alternatives: TemplateMatch[];
  found: boolean;
  message?: string | null;
}

export interface TemplateMatchResponse {
  error: false;
  message: string;
  body: TemplateMatchResponseBody;
}

// Question Generation
export interface QuestionRequest {
  template_id: string;
  user_query?: string | null;
}

export interface Question {
  key: string;
  question: string;
  description?: string | null;
  example?: string | null;
  required: boolean;
  dtype: string;
  regex?: string | null;
  enum_values?: string[] | null;
}

export interface QuestionResponseBody {
  questions: Question[];
  prefilled: Record<string, string | number | boolean | null>;
  template_id: string;
  template_title: string;
  message?: string | null;
}

export interface QuestionResponse {
  error: false;
  message: string;
  body: QuestionResponseBody;
}

// Draft Generation
export interface GenerateDraftRequest {
  template_id: string;
  answers: Record<string, string | number | boolean | null>;
  user_query?: string;
}

export interface GenerateDraftResponseBody {
  draft_md: string;
  instance_id: number;
  template_id: string;
  template_title: string;
  missing_variables: string[];
  has_missing_variables: boolean;
}

export interface GenerateDraftResponse {
  error: false;
  message: string;
  body: GenerateDraftResponseBody;
}

// ============================================================================
// API ENDPOINT TYPES (for reference)
// ============================================================================

// Upload endpoint
export type UploadAPIResponse = APIResponse<UploadResponseBody | DuplicateTemplateResponseBody>;

// Template endpoints
export type TemplateListAPIResponse = APIResponse<TemplateListResponseBody>;
export type TemplateGetAPIResponse = APIResponse<TemplateDetail>;
export type TemplateDeleteAPIResponse = APIResponse<TemplateDeleteResponseBody>;

// Draft endpoints
export type TemplateMatchAPIResponse = APIResponse<TemplateMatchResponseBody>;
export type QuestionAPIResponse = APIResponse<QuestionResponseBody>;
export type GenerateDraftAPIResponse = APIResponse<GenerateDraftResponseBody>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

// For error handling
export interface APIError {
  error: true;
  message: string;
  body: null;
}

// For type guards
export function isAPIError(response: APIResponse<unknown>): response is APIError {
  return response.error === true;
}

export function isSuccessResponse<T>(response: APIResponse<T>): response is APIResponse<T> & { error: false } {
  return response.error === false;
}
