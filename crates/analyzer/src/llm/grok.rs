use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::LlmProvider;

#[derive(Serialize)]
struct GrokRequest<'a> {
    model: &'a str,
    messages: Vec<GrokMessage<'a>>,
    max_tokens: u32,
}

#[derive(Serialize)]
struct GrokMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct GrokResponse {
    choices: Vec<GrokChoice>,
}

#[derive(Deserialize)]
struct GrokChoice {
    message: GrokChoiceMessage,
}

#[derive(Deserialize)]
struct GrokChoiceMessage {
    content: String,
}

/// xAI Grok LLM provider.
///
/// Uses the Grok chat completions API compatible with the OpenAI SDK format.
pub struct GrokProvider {
    api_key: String,
    model: String,
    client: Client,
}

impl GrokProvider {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: "grok-3".to_string(),
            client: Client::new(),
        }
    }

    #[allow(dead_code)]
    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
}

#[async_trait]
impl LlmProvider for GrokProvider {
    fn name(&self) -> &str {
        "grok"
    }

    async fn complete(&self, prompt: &str) -> Result<String> {
        let request = GrokRequest {
            model: &self.model,
            messages: vec![GrokMessage {
                role: "user",
                content: prompt,
            }],
            max_tokens: 1024,
        };

        let response = self
            .client
            .post("https://api.x.ai/v1/chat/completions")
            .bearer_auth(&self.api_key)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow!("Grok API error {}: {}", status, body));
        }

        let parsed: GrokResponse = response.json().await?;
        parsed
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .ok_or_else(|| anyhow!("Grok returned no choices"))
    }
}
