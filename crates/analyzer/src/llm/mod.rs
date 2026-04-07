use anyhow::Result;
use async_trait::async_trait;

/// Contract for every LLM provider.
///
/// Implementors handle authentication and API specifics; callers only see
/// `complete()` which takes a prompt and returns the model's response text.
#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// Human-readable name of this provider (e.g. "grok", "openai")
    fn name(&self) -> &str;

    /// Send `prompt` to the model and return the completion text.
    async fn complete(&self, prompt: &str) -> Result<String>;
}

pub mod grok;
pub mod openai;

pub use grok::GrokProvider;
pub use openai::OpenAiProvider;
