use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Mirrors the TypeScript `SocialPost` schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialPost {
    #[serde(rename = "platformId")]
    pub platform_id: String,
    pub platform: String,
    pub url: Option<String>,
    pub content: String,
    #[serde(rename = "rawContent")]
    pub raw_content: Option<String>,
    pub author: SocialUser,
    #[serde(rename = "publishedAt")]
    pub published_at: DateTime<Utc>,
    #[serde(rename = "collectedAt")]
    pub collected_at: DateTime<Utc>,
    pub tags: Vec<String>,
    #[serde(rename = "likeCount")]
    pub like_count: Option<i64>,
    #[serde(rename = "shareCount")]
    pub share_count: Option<i64>,
    #[serde(rename = "commentCount")]
    pub comment_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialUser {
    #[serde(rename = "platformId")]
    pub platform_id: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub platform: String,
}

/// Mirrors the TypeScript `SentimentResult` schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentResult {
    pub label: SentimentLabel,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SentimentLabel {
    Positive,
    Neutral,
    Negative,
}

impl std::fmt::Display for SentimentLabel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SentimentLabel::Positive => write!(f, "positive"),
            SentimentLabel::Neutral => write!(f, "neutral"),
            SentimentLabel::Negative => write!(f, "negative"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendEntry {
    pub topic: String,
    #[serde(rename = "postCount")]
    pub post_count: usize,
    #[serde(rename = "avgSentiment")]
    pub avg_sentiment: SentimentLabel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlgorithmDecision {
    pub algorithm: String,
    #[serde(rename = "llmProvider", skip_serializing_if = "Option::is_none")]
    pub llm_provider: Option<String>,
    pub summary: String,
    pub confidence: f64,
    #[serde(rename = "decidedAt")]
    pub decided_at: DateTime<Utc>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub id: String,
    #[serde(rename = "collectionRunId")]
    pub collection_run_id: String,
    #[serde(rename = "analyzedAt")]
    pub analyzed_at: DateTime<Utc>,
    /// keyed by post platformId
    pub sentiments: std::collections::HashMap<String, SentimentResult>,
    pub trends: Vec<TrendEntry>,
    pub decisions: Vec<AlgorithmDecision>,
}
