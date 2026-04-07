import axios from "axios";
import { randomUUID } from "crypto";
import type { SocialPost, SocialUser } from "../schema";
import { BaseAdapter, type AdapterConfig, type CollectionResult } from "./base";

interface RedditListing<T> {
  data: {
    children: Array<{ data: T }>;
    after?: string;
  };
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  subreddit: string;
  link_flair_text?: string;
}

/**
 * Adapter for the Reddit public API (no auth required for read-only access).
 * Fetches hot/new posts from configured subreddits or search queries.
 *
 * Required config keys: none (public API; `apiKey` used as optional bearer token)
 * Optional config keys: `topics` (treated as subreddit names), `maxPostsPerRun`
 */
export class RedditAdapter extends BaseAdapter {
  readonly name = "reddit";
  readonly requiredConfigKeys: string[] = [];

  private readonly baseUrl = "https://www.reddit.com";

  async collect(config: AdapterConfig): Promise<CollectionResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const posts: SocialPost[] = [];
    const topics: string[] = (config.topics as string[]) ?? ["technology", "artificial", "finance"];
    const maxPosts = (config.maxPostsPerRun as number) ?? 100;

    const headers: Record<string, string> = {
      "User-Agent": "KashCompiler/0.1.0 (data-collector)",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey as string}`;
    }

    let error: string | undefined;

    try {
      for (const subreddit of topics) {
        if (posts.length >= maxPosts) break;

        const response = await axios.get<RedditListing<RedditPost>>(
          `${this.baseUrl}/r/${subreddit}/hot.json`,
          {
            params: { limit: Math.min(maxPosts - posts.length, 100) },
            headers,
          }
        );

        const children = response.data.data.children;
        const collectedAt = new Date().toISOString();

        for (const child of children) {
          const item = child.data;

          const author: SocialUser = {
            platformId: item.author,
            username: item.author,
            profileUrl: `https://www.reddit.com/user/${item.author}`,
            platform: "reddit",
          };

          const content = item.selftext.trim() || item.title;

          posts.push({
            platformId: item.id,
            platform: "reddit",
            url: `https://www.reddit.com${item.permalink}`,
            content,
            rawContent: item.selftext,
            author,
            publishedAt: new Date(item.created_utc * 1000).toISOString(),
            collectedAt,
            tags: [subreddit, ...(item.link_flair_text ? [item.link_flair_text] : [])],
            likeCount: item.score,
            commentCount: item.num_comments,
            metadata: { title: item.title, subreddit: item.subreddit },
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
