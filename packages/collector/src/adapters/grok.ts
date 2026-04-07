import axios from "axios";
import { randomUUID } from "crypto";
import type { SocialPost, SocialUser } from "../schema";
import { BaseAdapter, type AdapterConfig, type CollectionResult } from "./base";

interface GrokSearchResult {
  id: string;
  text: string;
  created_at: string;
  author?: {
    id: string;
    username: string;
    name?: string;
    public_metrics?: { followers_count: number };
    profile_url?: string;
  };
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
  entities?: { hashtags?: Array<{ tag: string }> };
}

interface GrokSearchResponse {
  results?: GrokSearchResult[];
  data?: GrokSearchResult[];
}

/**
 * Adapter for the xAI Grok API.
 *
 * Uses the Grok search API endpoint to retrieve recent social posts
 * matching the configured topics.
 *
 * Required config keys: `apiKey`
 * Optional config keys: `topics`, `maxPostsPerRun`
 */
export class GrokAdapter extends BaseAdapter {
  readonly name = "grok";
  readonly requiredConfigKeys = ["apiKey"];

  private readonly baseUrl = "https://api.x.ai/v1";

  async collect(config: AdapterConfig): Promise<CollectionResult> {
    this.validateConfig(config);

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const posts: SocialPost[] = [];
    const topics: string[] = (config.topics as string[]) ?? ["technology", "AI", "finance"];
    const maxPosts = (config.maxPostsPerRun as number) ?? 100;

    let error: string | undefined;

    try {
      for (const topic of topics) {
        if (posts.length >= maxPosts) break;

        const response = await axios.post<GrokSearchResponse>(
          `${this.baseUrl}/search`,
          {
            query: topic,
            max_results: Math.min(maxPosts - posts.length, 50),
          },
          {
            headers: {
              Authorization: `Bearer ${config.apiKey as string}`,
              "Content-Type": "application/json",
            },
          }
        );

        const results: GrokSearchResult[] = response.data.results ?? response.data.data ?? [];
        const collectedAt = new Date().toISOString();

        for (const item of results) {
          const author: SocialUser = {
            platformId: item.author?.id ?? "unknown",
            username: item.author?.username ?? "unknown",
            displayName: item.author?.name,
            profileUrl: item.author?.profile_url,
            followerCount: item.author?.public_metrics?.followers_count,
            platform: "grok",
          };

          posts.push({
            platformId: item.id,
            platform: "grok",
            content: item.text,
            author,
            publishedAt: item.created_at,
            collectedAt,
            tags: [
              topic,
              ...(item.entities?.hashtags?.map((h) => h.tag) ?? []),
            ],
            likeCount: item.public_metrics?.like_count,
            shareCount: item.public_metrics?.retweet_count,
            commentCount: item.public_metrics?.reply_count,
          });
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      run: {
        id: runId,
        source: this.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        postsCollected: posts.length,
        error,
      },
      posts,
    };
  }
}
