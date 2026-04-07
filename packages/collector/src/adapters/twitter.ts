import axios from "axios";
import { randomUUID } from "crypto";
import type { SocialPost, SocialUser } from "../schema";
import { BaseAdapter, type AdapterConfig, type CollectionResult } from "./base";

interface TwitterTweetData {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
  entities?: { hashtags?: Array<{ tag: string }> };
}

interface TwitterUserData {
  id: string;
  username: string;
  name: string;
  public_metrics?: { followers_count: number };
  profile_image_url?: string;
}

interface TwitterSearchResponse {
  data?: TwitterTweetData[];
  includes?: { users?: TwitterUserData[] };
  meta?: { next_token?: string; result_count: number };
}

/**
 * Adapter for the Twitter/X v2 API.
 *
 * Searches recent tweets for the configured topics using Bearer Token auth.
 *
 * Required config keys: `apiKey` (Bearer Token)
 * Optional config keys: `topics`, `maxPostsPerRun`
 */
export class TwitterAdapter extends BaseAdapter {
  readonly name = "twitter";
  readonly requiredConfigKeys = ["apiKey"];

  private readonly baseUrl = "https://api.twitter.com/2";

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

        const response = await axios.get<TwitterSearchResponse>(
          `${this.baseUrl}/tweets/search/recent`,
          {
            params: {
              query: `${topic} lang:en -is:retweet`,
              max_results: Math.min(maxPosts - posts.length, 100),
              "tweet.fields": "created_at,public_metrics,entities,author_id",
              "user.fields": "username,name,public_metrics,profile_image_url",
              expansions: "author_id",
            },
            headers: {
              Authorization: `Bearer ${config.apiKey as string}`,
            },
          }
        );

        const tweets = response.data.data ?? [];
        const usersById = new Map<string, TwitterUserData>(
          (response.data.includes?.users ?? []).map((u) => [u.id, u])
        );
        const collectedAt = new Date().toISOString();

        for (const tweet of tweets) {
          const twitterUser = tweet.author_id ? usersById.get(tweet.author_id) : undefined;

          const author: SocialUser = {
            platformId: twitterUser?.id ?? tweet.author_id ?? "unknown",
            username: twitterUser?.username ?? "unknown",
            displayName: twitterUser?.name,
            profileUrl: twitterUser
              ? `https://twitter.com/${twitterUser.username}`
              : undefined,
            followerCount: twitterUser?.public_metrics?.followers_count,
            platform: "twitter",
          };

          posts.push({
            platformId: tweet.id,
            platform: "twitter",
            content: tweet.text,
            url: `https://twitter.com/i/web/status/${tweet.id}`,
            author,
            publishedAt: tweet.created_at ?? collectedAt,
            collectedAt,
            tags: [
              topic,
              ...(tweet.entities?.hashtags?.map((h) => h.tag) ?? []),
            ],
            likeCount: tweet.public_metrics?.like_count,
            shareCount: tweet.public_metrics?.retweet_count,
            commentCount: tweet.public_metrics?.reply_count,
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
