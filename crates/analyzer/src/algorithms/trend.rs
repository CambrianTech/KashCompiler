use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;

use crate::llm::LlmProvider;
use crate::models::{AlgorithmDecision, AnalysisResult, SentimentLabel, TrendEntry, SocialPost};
use super::Algorithm;

/// Trend detection algorithm.
///
/// Aggregates posts by tag/topic, computes frequency and dominant sentiment,
/// then optionally asks an LLM to summarise the top trends into a decision.
pub struct TrendAlgorithm {
    llm: Option<Arc<dyn LlmProvider>>,
    /// Minimum number of posts required to surface a trend
    min_post_count: usize,
}

impl TrendAlgorithm {
    pub fn new() -> Self {
        Self { llm: None, min_post_count: 2 }
    }

    pub fn with_llm(llm: Arc<dyn LlmProvider>) -> Self {
        Self { llm: Some(llm), min_post_count: 2 }
    }

    #[allow(dead_code)]
    pub fn with_min_post_count(mut self, n: usize) -> Self {
        self.min_post_count = n;
        self
    }

    fn dominant_sentiment(labels: &[SentimentLabel]) -> SentimentLabel {
        let pos = labels.iter().filter(|l| **l == SentimentLabel::Positive).count();
        let neg = labels.iter().filter(|l| **l == SentimentLabel::Negative).count();
        if pos > neg { SentimentLabel::Positive }
        else if neg > pos { SentimentLabel::Negative }
        else { SentimentLabel::Neutral }
    }
}

impl Default for TrendAlgorithm {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Algorithm for TrendAlgorithm {
    fn name(&self) -> &str {
        "trend-detection"
    }

    async fn run(
        &self,
        posts: &[SocialPost],
        result: &AnalysisResult,
    ) -> Result<Vec<AlgorithmDecision>> {
        // Aggregate tags → { count, sentiments[] }
        let mut tag_map: HashMap<String, (usize, Vec<SentimentLabel>)> = HashMap::new();

        for post in posts {
            let sentiment = result
                .sentiments
                .get(&post.platform_id)
                .map(|s| s.label.clone())
                .unwrap_or(SentimentLabel::Neutral);

            for tag in &post.tags {
                let entry = tag_map.entry(tag.clone()).or_default();
                entry.0 += 1;
                entry.1.push(sentiment.clone());
            }
        }

        let mut trends: Vec<TrendEntry> = tag_map
            .into_iter()
            .filter(|(_, (count, _))| *count >= self.min_post_count)
            .map(|(topic, (post_count, sentiments))| TrendEntry {
                topic,
                post_count,
                avg_sentiment: Self::dominant_sentiment(&sentiments),
            })
            .collect();

        // Sort descending by post count
        trends.sort_by(|a, b| b.post_count.cmp(&a.post_count));
        let top_trends = &trends[..trends.len().min(10)];

        let summary = if top_trends.is_empty() {
            "No significant trends detected.".to_string()
        } else if let Some(ref llm) = self.llm {
            let trend_list = top_trends
                .iter()
                .map(|t| format!("{} ({} posts, {} sentiment)", t.topic, t.post_count, t.avg_sentiment))
                .collect::<Vec<_>>()
                .join("; ");

            let prompt = format!(
                "Summarise the following social media trends in 1-2 sentences for an algorithmic trader:\n{trend_list}"
            );
            llm.complete(&prompt).await.unwrap_or_else(|_| {
                format!("Top trends: {trend_list}")
            })
        } else {
            format!(
                "Top {} trend(s): {}",
                top_trends.len(),
                top_trends
                    .iter()
                    .map(|t| t.topic.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        };

        let provider = self.llm.as_ref().map(|l| l.name().to_string());
        let trends_json = serde_json::to_value(top_trends)?;

        Ok(vec![AlgorithmDecision {
            algorithm: self.name().to_string(),
            llm_provider: provider,
            summary,
            confidence: 0.75,
            decided_at: Utc::now(),
            payload: serde_json::json!({ "trends": trends_json }),
        }])
    }
}
