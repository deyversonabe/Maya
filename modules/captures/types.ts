import type { BankStatementDraft, FinancialDocumentDraft } from "@/modules/finance/types";

export type CaptureSource = "app" | "whatsapp" | "ofx" | "open_finance";
export type CaptureKind = "financial_document" | "bank_statement" | "text" | "audio";
export type CaptureStatus = "pending" | "confirmed" | "discarded" | "expired";
export type CaptureValidationStatus = "ready" | "review" | "blocked";

export interface CaptureValidationIssue {
  code: string;
  level: "info" | "warning" | "error";
  field?: string;
  message: string;
}

export interface CaptureValidationReport {
  status: CaptureValidationStatus;
  score: number;
  issues: CaptureValidationIssue[];
  checks: Array<{
    code: string;
    label: string;
    ok: boolean;
    detail?: string;
  }>;
}

export type CaptureDraft =
  | { type: "financial_document"; value: FinancialDocumentDraft }
  | { type: "bank_statement"; value: BankStatementDraft };

export interface FinanceCaptureRecord {
  id: string;
  workspaceId: string;
  source: CaptureSource;
  sourceRef?: string;
  sender?: string;
  kind: CaptureKind;
  status: CaptureStatus;
  validationStatus: CaptureValidationStatus;
  validationScore: number;
  title: string;
  rawText?: string;
  draft: CaptureDraft;
  validation: CaptureValidationReport;
  attachmentName?: string;
  attachmentMimeType?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  confirmedAt?: string;
}
