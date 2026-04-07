import type { SocialPost, CollectionRun } from "../schema";

/**
 * Configuration passed to every adapter at construction time.
 * Concrete adapters declare their required keys via `requiredConfigKeys`.
 */
export interface AdapterConfig {
  /** API key or access token for the source */
  apiKey?: string;
  /** Free-text search queries / topics to collect */
  topics?: string[];
  /** Maximum number of posts to collect per run */
  maxPostsPerRun?: number;
  /** Any additional adapter-specific settings */
  [key: string]: unknown;
}

/**
 * Result returned after a single collection run.
 */
export interface CollectionResult {
  run: CollectionRun;
  posts: SocialPost[];
}

/**
 * Base contract that every social media adapter must implement.
 *
 * Adapters are stateless – all state is passed in via `collect()`.
 * This keeps them composable and easy to test.
 */
export abstract class BaseAdapter {
  /** Human-readable source name (e.g. "twitter", "reddit") */
  abstract readonly name: string;

  /** Config keys that MUST be present for this adapter to function */
  abstract readonly requiredConfigKeys: string[];

  /**
   * Validate that `config` contains all required keys.
   * Throws if any key is missing.
   */
  protected validateConfig(config: AdapterConfig): void {
    for (const key of this.requiredConfigKeys) {
      if (config[key] === undefined || config[key] === null || config[key] === "") {
        throw new Error(`[${this.name}] Missing required config key: ${key}`);
      }
    }
  }

  /**
   * Collect posts from the social media source.
   * Must be implemented by each concrete adapter.
   */
  abstract collect(config: AdapterConfig): Promise<CollectionResult>;
}
