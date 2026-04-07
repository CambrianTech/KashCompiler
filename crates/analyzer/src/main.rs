/*!
 * KashCompiler Analyzer
 *
 * Reads collected social media posts from a JSON file (produced by the
 * TypeScript collector), runs the pluggable algorithm pipeline, and writes
 * `AnalysisResult` JSON to stdout or a file.
 *
 * Usage:
 *   analyzer --input posts.json [--output result.json] [--llm grok] [--algorithms sentiment,trend-detection]
 *
 * Environment variables:
 *   GROK_API_KEY       – xAI Grok API key
 *   OPENAI_API_KEY     – OpenAI API key
 */

use std::{collections::HashMap, path::PathBuf, sync::Arc};

use anyhow::{Context, Result};
use chrono::Utc;
use clap::Parser;
use uuid::Uuid;

mod algorithms;
mod llm;
mod models;

use algorithms::{Algorithm, SentimentAlgorithm, TrendAlgorithm};
use llm::{GrokProvider, LlmProvider, OpenAiProvider};
use models::{AnalysisResult, SocialPost};

#[derive(Parser, Debug)]
#[command(name = "analyzer", about = "KashCompiler LLM-powered analysis backend")]
struct Cli {
    /// Path to the JSON file containing collected SocialPost objects
    #[arg(short, long)]
    input: PathBuf,

    /// Path to write the AnalysisResult JSON (default: stdout)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// LLM provider to use: "grok" | "openai" | "none" (default: none)
    #[arg(long, default_value = "none")]
    llm: String,

    /// Collection run ID to associate with this analysis
    #[arg(long, default_value = "")]
    run_id: String,

    /// Comma-separated list of algorithms to run (default: sentiment,trend-detection)
    #[arg(long, default_value = "sentiment,trend-detection")]
    algorithms: String,
}

fn build_llm_provider(name: &str) -> Option<Arc<dyn LlmProvider>> {
    match name {
        "grok" => {
            let key = std::env::var("GROK_API_KEY").ok()?;
            Some(Arc::new(GrokProvider::new(key)))
        }
        "openai" => {
            let key = std::env::var("OPENAI_API_KEY").ok()?;
            Some(Arc::new(OpenAiProvider::new(key)))
        }
        _ => None,
    }
}

fn build_algorithms(
    names: &[&str],
    llm: Option<Arc<dyn LlmProvider>>,
) -> Vec<Box<dyn Algorithm>> {
    names
        .iter()
        .filter_map(|&name| -> Option<Box<dyn Algorithm>> {
            match name {
                "sentiment" => {
                    let algo = match &llm {
                        Some(l) => SentimentAlgorithm::with_llm(Arc::clone(l)),
                        None => SentimentAlgorithm::new(),
                    };
                    Some(Box::new(algo))
                }
                "trend-detection" => {
                    let algo = match &llm {
                        Some(l) => TrendAlgorithm::with_llm(Arc::clone(l)),
                        None => TrendAlgorithm::new(),
                    };
                    Some(Box::new(algo))
                }
                other => {
                    eprintln!("[analyzer] Unknown algorithm: {other} – skipping");
                    None
                }
            }
        })
        .collect()
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env if present
    let _ = dotenvy::dotenv();

    let cli = Cli::parse();

    // Load posts
    let json_bytes =
        std::fs::read(&cli.input).with_context(|| format!("reading {:?}", cli.input))?;
    let posts: Vec<SocialPost> =
        serde_json::from_slice(&json_bytes).context("parsing posts JSON")?;

    eprintln!("[analyzer] Loaded {} posts from {:?}", posts.len(), cli.input);

    let run_id = if cli.run_id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        cli.run_id.clone()
    };

    // Build initial (empty) result
    let mut result = AnalysisResult {
        id: Uuid::new_v4().to_string(),
        collection_run_id: run_id,
        analyzed_at: Utc::now(),
        sentiments: HashMap::new(),
        trends: Vec::new(),
        decisions: Vec::new(),
    };

    // Build LLM provider (optional)
    let llm = build_llm_provider(&cli.llm);
    if llm.is_some() {
        eprintln!("[analyzer] Using LLM provider: {}", cli.llm);
    } else if cli.llm != "none" {
        eprintln!("[analyzer] LLM provider '{}' not configured – falling back to heuristics", cli.llm);
    }

    // Build & run algorithms in order
    let algo_names: Vec<&str> = cli.algorithms.split(',').map(str::trim).collect();
    let algorithms = build_algorithms(&algo_names, llm);

    for algo in &algorithms {
        eprintln!("[analyzer] Running algorithm: {}", algo.name());
        let decisions = algo.run(&posts, &result).await?;
        eprintln!("[analyzer]   → {} decision(s)", decisions.len());
        result.decisions.extend(decisions);
    }

    // Serialise output
    let output_json = serde_json::to_string_pretty(&result).context("serialising result")?;

    match &cli.output {
        Some(path) => {
            std::fs::write(path, &output_json)
                .with_context(|| format!("writing result to {path:?}"))?;
            eprintln!("[analyzer] Result written to {:?}", path);
        }
        None => {
            println!("{output_json}");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use models::{SentimentLabel, SentimentResult, SocialPost, SocialUser};
    use chrono::Utc;

    fn make_post(id: &str, content: &str, tags: Vec<String>) -> SocialPost {
        SocialPost {
            platform_id: id.to_string(),
            platform: "test".to_string(),
            url: None,
            content: content.to_string(),
            raw_content: None,
            author: SocialUser {
                platform_id: "u1".to_string(),
                username: "tester".to_string(),
                display_name: None,
                platform: "test".to_string(),
            },
            published_at: Utc::now(),
            collected_at: Utc::now(),
            tags,
            like_count: None,
            share_count: None,
            comment_count: None,
        }
    }

    fn empty_result(run_id: &str) -> AnalysisResult {
        AnalysisResult {
            id: Uuid::new_v4().to_string(),
            collection_run_id: run_id.to_string(),
            analyzed_at: Utc::now(),
            sentiments: HashMap::new(),
            trends: Vec::new(),
            decisions: Vec::new(),
        }
    }

    #[tokio::test]
    async fn sentiment_algorithm_produces_decisions() {
        let posts = vec![
            make_post("p1", "This is an amazing growth opportunity!", vec!["AI".to_string()]),
            make_post("p2", "Terrible crash and massive loss today.", vec!["finance".to_string()]),
            make_post("p3", "Just a normal day.", vec!["tech".to_string()]),
        ];
        let result = empty_result("run-1");
        let algo = SentimentAlgorithm::new();
        let decisions = algo.run(&posts, &result).await.unwrap();
        assert!(!decisions.is_empty());
        assert_eq!(decisions[0].algorithm, "sentiment");
        // payload should contain sentiments map
        assert!(decisions[0].payload["sentiments"].is_object());
    }

    #[tokio::test]
    async fn trend_algorithm_detects_repeated_tags() {
        let posts = vec![
            make_post("p1", "AI is great", vec!["AI".to_string(), "tech".to_string()]),
            make_post("p2", "AI is also great", vec!["AI".to_string()]),
            make_post("p3", "tech is everywhere", vec!["tech".to_string()]),
        ];
        let mut result = empty_result("run-2");
        // Populate minimal sentiments so trend can read them
        result.sentiments.insert("p1".to_string(), SentimentResult { label: SentimentLabel::Positive, score: 0.9 });
        result.sentiments.insert("p2".to_string(), SentimentResult { label: SentimentLabel::Positive, score: 0.8 });
        result.sentiments.insert("p3".to_string(), SentimentResult { label: SentimentLabel::Neutral, score: 0.5 });

        let algo = TrendAlgorithm::new().with_min_post_count(2);
        let decisions = algo.run(&posts, &result).await.unwrap();
        assert!(!decisions.is_empty());
        let trends = &decisions[0].payload["trends"];
        assert!(trends.as_array().map(|a| !a.is_empty()).unwrap_or(false));
        // "AI" should appear since it has 2 posts
        let trend_topics: Vec<&str> = trends.as_array().unwrap()
            .iter()
            .filter_map(|t| t["topic"].as_str())
            .collect();
        assert!(trend_topics.contains(&"AI"));
    }

    #[test]
    fn build_llm_provider_none() {
        // Without env vars, non-"none" provider should return None
        std::env::remove_var("GROK_API_KEY");
        let provider = build_llm_provider("grok");
        assert!(provider.is_none());
    }

    #[test]
    fn build_llm_provider_with_key() {
        std::env::set_var("GROK_API_KEY", "test-key");
        let provider = build_llm_provider("grok");
        assert!(provider.is_some());
        assert_eq!(provider.unwrap().name(), "grok");
        std::env::remove_var("GROK_API_KEY");
    }
}
