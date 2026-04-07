/**
 * Analysis result schema – output produced by the Rust analyzer
 * and stored back into the ORM for downstream consumption.
 */

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentResult {
  label: SentimentLabel;
  /** Confidence score 0–1 */
  score: number;
}

export interface TrendEntry {
  /** Trend keyword or topic */
  topic: string;
  /** Number of posts mentioning this topic */
  postCount: number;
  /** Average sentiment across those posts */
  avgSentiment: SentimentLabel;
}

export interface AlgorithmDecision {
  /** Name of the algorithm that produced this decision */
  algorithm: string;
  /** LLM provider used (e.g. "grok", "openai") */
  llmProvider?: string;
  /** Human-readable summary of the decision */
  summary: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** ISO-8601 timestamp */
  decidedAt: string;
  /** Arbitrary structured output from the algorithm */
  payload: Record<string, unknown>;
}

export interface AnalysisResult {
  /** Unique result identifier */
  id: string;
  /** Collection run that was analyzed */
  collectionRunId: string;
  /** ISO-8601 timestamp */
  analyzedAt: string;
  /** Per-post sentiment results keyed by platformId */
  sentiments: Record<string, SentimentResult>;
  /** Detected trends */
  trends: TrendEntry[];
  /** Decisions produced by the pluggable algorithms */
  decisions: AlgorithmDecision[];
}
