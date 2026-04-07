/**
 * Social media post schema – the core unit of collected data.
 * Defined purely in TypeScript and mirrored in the Prisma ORM schema.
 */
export type SocialPlatform = "twitter" | "reddit" | "grok" | "unknown";

export interface SocialUser {
  /** Platform-local user identifier */
  platformId: string;
  username: string;
  displayName?: string;
  profileUrl?: string;
  followerCount?: number;
  platform: SocialPlatform;
}

export interface SocialPost {
  /** Platform-local post identifier */
  platformId: string;
  platform: SocialPlatform;
  /** Original URL of the post */
  url?: string;
  /** Plain-text content */
  content: string;
  /** Raw content as returned by the API (may include markdown, html, etc.) */
  rawContent?: string;
  /** Author information */
  author: SocialUser;
  /** ISO-8601 timestamp when the post was published */
  publishedAt: string;
  /** ISO-8601 timestamp when the record was collected */
  collectedAt: string;
  /** Topic/hashtag/subreddit context */
  tags: string[];
  /** Number of likes / upvotes */
  likeCount?: number;
  /** Number of reposts / shares */
  shareCount?: number;
  /** Number of comments / replies */
  commentCount?: number;
  /** Arbitrary extra metadata from the API */
  metadata?: Record<string, unknown>;
}

export interface CollectionRun {
  /** Unique run identifier */
  id: string;
  /** Source adapter name */
  source: string;
  /** ISO-8601 start time */
  startedAt: string;
  /** ISO-8601 end time (null while running) */
  finishedAt?: string;
  /** Number of posts collected in this run */
  postsCollected: number;
  /** Error message if the run failed */
  error?: string;
}
