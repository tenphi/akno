import type { ModelClient } from '../models/client.ts';

type ExtractionTextFrom = 'text-layer' | 'ocr' | 'plain' | 'textutil' | 'vision' | 'none';
type ExtractionBackendName = 'macos-native' | 'model-fallback' | 'unsupported';
type ExtractionTool = 'pdfkit' | 'vision' | 'textutil' | 'filesystem' | 'vision-model' | null;

interface ExtractionSection {
  page: number;
  text: string;
}

interface ExtractionPages {
  count: number;
  sections: ExtractionSection[];
}

export interface ExtractionProvenance {
  backend: ExtractionBackendName;
  tool: ExtractionTool;
}

interface UnsupportedPlatformDegradation {
  kind: 'unsupported-platform';
  message: string;
  platform: string;
}

interface ExtractionFailedDegradation {
  kind: 'extraction-failed';
  message: string;
}

interface PartialExtractionDegradation {
  kind: 'partial-extraction';
  message: string;
  pages_read: number;
  pages_total: number;
}

type ExtractionDegradation =
  UnsupportedPlatformDegradation | ExtractionFailedDegradation | PartialExtractionDegradation;

export interface DocumentExtractionResult {
  text: string;
  pages: ExtractionPages | null;
  ocr: boolean;
  confidence: number | null;
  provenance: ExtractionProvenance;
  text_from: ExtractionTextFrom;
  degradation: ExtractionDegradation | null;
}

export interface DocumentExtractionRequest {
  absPath: string;
  maxOcrPages: number;
  maxBytes: number;
  vision?: ModelClient;
}

export interface DocumentExtractorBackend {
  name: ExtractionBackendName;
  extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult>;
}

interface AvailableBackends {
  macos: DocumentExtractorBackend;
}

export function selectDocumentExtractorBackend(
  platform: string,
  backends: AvailableBackends,
): DocumentExtractorBackend {
  return platform === 'darwin' ? backends.macos : unsupportedBackend(platform);
}

function unsupportedBackend(platform: string): DocumentExtractorBackend {
  return {
    name: 'unsupported',
    extract: async () => ({
      text: '',
      pages: null,
      ocr: false,
      confidence: null,
      provenance: { backend: 'unsupported', tool: null },
      text_from: 'none',
      degradation: {
        kind: 'unsupported-platform',
        message: `document extraction is not supported on ${platform}`,
        platform,
      },
    }),
  };
}
