use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;

use crate::llm::LlmProvider;
use crate::models::{AlgorithmDecision, AnalysisResult, SentimentLabel, SentimentResult, SocialPost};
use super::Algorithm;

/// Sentiment analysis algorithm.
///
/// When an LLM provider is supplied the algorithm asks the LLM to score
/// each post's sentiment.  Without an LLM provider it falls back to a
/// simple keyword-based heuristic so tests and offline runs still work.
pub struct SentimentAlgorithm {
    llm: Option<Arc<dyn LlmProvider>>,
}

impl SentimentAlgorithm {
    pub fn new() -> Self {
        Self { llm: None }
    }

    pub fn with_llm(llm: Arc<dyn LlmProvider>) -> Self {
        Self { llm: Some(llm) }
    }

    /// Heuristic fallback: count positive/negative keywords.
    fn heuristic_sentiment(text: &str) -> SentimentResult {
        let lower = text.to_lowercase();
        let positive_keywords = [
            "good", "great", "excellent", "amazing", "awesome", "positive",
            "bullish", "up", "rise", "growth", "profit", "win",
        ];
        let negative_keywords = [
            "bad", "terrible", "awful", "negative", "bearish", "down",
            "fall", "loss", "crash", "fail", "risk", "danger",
        ];

        let pos_count = positive_keywords.iter().filter(|&&kw| lower.contains(kw)).count();
        let neg_count = negative_keywords.iter().filter(|&&kw| lower.contains(kw)).count();

        let total = (pos_count + neg_count).max(1) as f64;
        if pos_count > neg_count {
            SentimentResult {
                label: SentimentLabel::Positive,
                score: pos_count as f64 / total,
            }
        } else if neg_count > pos_count {
            SentimentResult {
                label: SentimentLabel::Negative,
                score: neg_count as f64 / total,
            }
        } else {
            SentimentResult {
                label: SentimentLabel::Neutral,
                score: 0.5,
            }
        }
    }

    async fn llm_sentiment(llm: &dyn LlmProvider, text: &str) -> SentimentResult {
        let prompt = format!(
            "Classify the sentiment of the following text as exactly one of: positive, neutral, negative. \
             Reply with a JSON object: {{\"label\": \"<label>\", \"score\": <0.0-1.0>}}.\n\nText: {text}"
        );
        match llm.complete(&prompt).await {
            Ok(response) => {
                // Extract JSON from the response
                if let Some(start) = response.find('{') {
                    if let Some(end) = response.rfind('}') {
                        let json_str = &response[start..=end];
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(json_str) {
                            let label = match v["label"].as_str().unwrap_or("neutral") {
                                "positive" => SentimentLabel::Positive,
                                "negative" => SentimentLabel::Negative,
                                _ => SentimentLabel::Neutral,
                            };
                            let score = v["score"].as_f64().unwrap_or(0.5);
                            return SentimentResult { label, score };
                        }
                    }
                }
                Self::heuristic_sentiment(text)
            }
            Err(_) => Self::heuristic_sentiment(text),
        }
    }
}

impl Default for SentimentAlgorithm {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Algorithm for SentimentAlgorithm {
    fn name(&self) -> &str {
        "sentiment"
    }

    async fn run(
        &self,
        posts: &[SocialPost],
        _result: &AnalysisResult,
    ) -> Result<Vec<AlgorithmDecision>> {
        let mut sentiments: HashMap<String, SentimentResult> = HashMap::new();

        for post in posts {
            let sentiment = if let Some(ref llm) = self.llm {
                Self::llm_sentiment(llm.as_ref(), &post.content).await
            } else {
                Self::heuristic_sentiment(&post.content)
            };
            sentiments.insert(post.platform_id.clone(), sentiment);
        }

        let pos = sentiments.values().filter(|s| s.label == SentimentLabel::Positive).count();
        let neg = sentiments.values().filter(|s| s.label == SentimentLabel::Negative).count();
        let total = sentiments.len();

        let overall = if pos as f64 / total.max(1) as f64 >= 0.6 {
            "predominantly positive"
        } else if neg as f64 / total.max(1) as f64 >= 0.6 {
            "predominantly negative"
        } else {
            "mixed"
        };

        let provider = self.llm.as_ref().map(|l| l.name().to_string());
        let sentiments_json = serde_json::to_value(&sentiments)?;

        Ok(vec![AlgorithmDecision {
            algorithm: self.name().to_string(),
            llm_provider: provider,
            summary: format!(
                "Sentiment analysis of {} posts: {} positive, {} negative, {} neutral – overall {overall}.",
                total, pos, neg, total - pos - neg
            ),
            confidence: 0.8,
            decided_at: Utc::now(),
            payload: serde_json::json!({
                "sentiments": sentiments_json,
                "positiveCount": pos,
                "negativeCount": neg,
            }),
        }])
    }
}
