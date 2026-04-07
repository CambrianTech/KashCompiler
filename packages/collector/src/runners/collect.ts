/**
 * Collection runner – intended to be invoked by GitHub Actions scheduled
 * workflows or manually.
 *
 * Environment variables consumed:
 *   DATABASE_URL        – SQLite path or PostgreSQL connection string
 *   GROK_API_KEY        – xAI Grok API key
 *   TWITTER_BEARER_TOKEN – Twitter/X v2 Bearer Token
 *   REDDIT_API_KEY      – Reddit OAuth token (optional; uses public API if absent)
 *   COLLECT_SOURCES     – Comma-separated list of adapters to run (default: all)
 *   COLLECT_TOPICS      – Comma-separated list of topics/subreddits to collect
 *   MAX_POSTS_PER_RUN   – Maximum posts per adapter per run (default: 100)
 */

import { defaultRegistry } from "../adapters";
import { createCollectionRun, finalizeCollectionRun, savePosts } from "../orm";

async function main(): Promise<void> {
  const requestedSources = process.env.COLLECT_SOURCES
    ? process.env.COLLECT_SOURCES.split(",").map((s) => s.trim())
    : defaultRegistry.list();

  const topics = process.env.COLLECT_TOPICS
    ? process.env.COLLECT_TOPICS.split(",").map((t) => t.trim())
    : undefined;

  const maxPostsPerRun = process.env.MAX_POSTS_PER_RUN
    ? parseInt(process.env.MAX_POSTS_PER_RUN, 10)
    : 100;

  const apiKeyBySource: Record<string, string | undefined> = {
    grok: process.env.GROK_API_KEY,
    twitter: process.env.TWITTER_BEARER_TOKEN,
    reddit: process.env.REDDIT_API_KEY,
  };

  console.log(`[collect] Starting collection for sources: ${requestedSources.join(", ")}`);

  for (const sourceName of requestedSources) {
    let adapter;
    try {
      adapter = defaultRegistry.get(sourceName);
    } catch (err) {
      console.error(`[collect] ${(err as Error).message}`);
      continue;
    }

    console.log(`[collect] Running adapter: ${sourceName}`);

    const config = {
      apiKey: apiKeyBySource[sourceName],
      topics,
      maxPostsPerRun,
    };

    const { run, posts } = await adapter.collect(config);

    if (run.error) {
      console.error(`[collect] Adapter "${sourceName}" encountered an error: ${run.error}`);
    }

    // Persist to database
    await createCollectionRun(run);
    const saved = await savePosts(posts, run.id);
    await finalizeCollectionRun({ ...run, postsCollected: saved });

    console.log(`[collect] ${sourceName}: collected ${posts.length} posts, saved ${saved}`);
  }

  console.log("[collect] Done");
}

main().catch((err: unknown) => {
  console.error("[collect] Fatal error:", err);
  process.exit(1);
});
