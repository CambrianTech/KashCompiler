# KashCompiler

Social media data gathering → LLM-powered analysis → algorithmic decision making.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Actions  (scheduled every 6 hours or manually triggered) │
│                                                                   │
│  packages/collector  (TypeScript)                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Adapter Registry                                        │    │
│  │   ├── GrokAdapter    (xAI Grok API)                      │    │
│  │   ├── TwitterAdapter (Twitter/X v2 API)                  │    │
│  │   └── RedditAdapter  (Reddit public API)                 │    │
│  │                                                          │    │
│  │  TypeScript Schemas  →  Prisma ORM  →  SQLite / Postgres │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  crates/analyzer  (Rust)                                          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Algorithm Pipeline (pluggable trait)                    │    │
│  │   ├── SentimentAlgorithm  (heuristic + LLM)             │    │
│  │   └── TrendAlgorithm      (tag aggregation + LLM)        │    │
│  │                                                          │    │
│  │  LLM Providers (pluggable trait)                         │    │
│  │   ├── GrokProvider   (xAI)                               │    │
│  │   └── OpenAiProvider (OpenAI / compatible)               │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository layout

```
KashCompiler/
├── packages/
│   └── collector/          # TypeScript data collection
│       ├── src/
│       │   ├── schema/     # TypeScript-first data schemas
│       │   ├── adapters/   # Social media adapter framework
│       │   ├── orm/        # Prisma client helpers
│       │   └── runners/    # CLI entry points
│       └── prisma/
│           └── schema.prisma
├── crates/
│   └── analyzer/           # Rust analysis backend
│       └── src/
│           ├── algorithms/ # Pluggable algorithm trait + implementations
│           ├── llm/        # Pluggable LLM provider trait + implementations
│           └── models/     # Rust data models mirroring TS schemas
└── .github/
    └── workflows/
        ├── ci.yml          # Lint, build, test on every push / PR
        └── collect.yml     # Scheduled collection + analysis
```

---

## Quick start

### Prerequisites

- Node.js ≥ 18
- Rust (stable) via [rustup](https://rustup.rs)

### 1 – Install dependencies

```bash
npm install
```

### 2 – Configure environment

Copy `.env.example` to `packages/collector/.env` and fill in your API keys:

```bash
cp .env.example packages/collector/.env
```

| Variable               | Description                          |
|------------------------|--------------------------------------|
| `DATABASE_URL`         | SQLite path or PostgreSQL URL        |
| `GROK_API_KEY`         | xAI Grok API key                     |
| `TWITTER_BEARER_TOKEN` | Twitter/X v2 Bearer Token            |
| `REDDIT_API_KEY`       | Reddit OAuth token (optional)        |

### 3 – Set up the database

```bash
cd packages/collector
npx prisma db push
```

### 4 – Run data collection

```bash
# Collect from all configured adapters
npm run collect

# Or run specific adapters / topics
COLLECT_SOURCES=reddit COLLECT_TOPICS=technology,finance npm run collect
```

### 5 – Run the Rust analyzer

```bash
cargo build --release -p analyzer

# Export posts to JSON first (example using sqlite3 or Prisma)
./target/release/analyzer --input posts.json --llm grok
```

---

## GitHub Actions secrets

Add these secrets to your repository for the scheduled workflows to work:

| Secret                 | Description                          |
|------------------------|--------------------------------------|
| `GROK_API_KEY`         | xAI Grok API key                     |
| `TWITTER_BEARER_TOKEN` | Twitter/X v2 Bearer Token            |
| `REDDIT_API_KEY`       | Reddit OAuth bearer token (optional) |
| `OPENAI_API_KEY`       | OpenAI API key (optional)            |

---

## Adding a custom adapter

1. Extend `BaseAdapter` in `packages/collector/src/adapters/`:

```typescript
export class MyAdapter extends BaseAdapter {
  readonly name = "my-source";
  readonly requiredConfigKeys = ["apiKey"];

  async collect(config: AdapterConfig): Promise<CollectionResult> {
    // ... fetch posts, map to SocialPost schema
  }
}
```

2. Register it at startup:

```typescript
import { defaultRegistry } from "@kashcompiler/collector";
defaultRegistry.register(new MyAdapter());
```

---

## Adding a custom algorithm (Rust)

Implement the `Algorithm` trait and push your decisions:

```rust
pub struct MyAlgorithm;

#[async_trait]
impl Algorithm for MyAlgorithm {
    fn name(&self) -> &str { "my-algorithm" }

    async fn run(&self, posts: &[SocialPost], result: &AnalysisResult) -> Result<Vec<AlgorithmDecision>> {
        // ... analyse posts, return decisions
    }
}
```

Pass it to the pipeline in `main.rs`.

---

## License

Apache 2.0 – see [LICENSE](LICENSE).
