import { PrismaClient } from "@prisma/client";
import type { SocialPost, CollectionRun, SocialUser } from "../schema";

// Re-use the PrismaClient instance across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// ─── Write helpers ───────────────────────────────────────────────────────────

/** Upsert a SocialUser record, returning the database-internal ID */
async function upsertUser(user: SocialUser): Promise<string> {
  const record = await prisma.socialUser.upsert({
    where: { platform_platformId: { platform: user.platform, platformId: user.platformId } },
    create: {
      platformId: user.platformId,
      platform: user.platform,
      username: user.username,
      displayName: user.displayName,
      profileUrl: user.profileUrl,
      followerCount: user.followerCount,
    },
    update: {
      username: user.username,
      displayName: user.displayName,
      profileUrl: user.profileUrl,
      followerCount: user.followerCount,
    },
  });
  return record.id;
}

/** Persist a collection run record (startedAt snapshot) */
export async function createCollectionRun(run: CollectionRun): Promise<void> {
  await prisma.collectionRun.create({
    data: {
      id: run.id,
      source: run.source,
      startedAt: new Date(run.startedAt),
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
      postsCollected: run.postsCollected,
      error: run.error,
    },
  });
}

/** Update a collection run after completion */
export async function finalizeCollectionRun(run: CollectionRun): Promise<void> {
  await prisma.collectionRun.update({
    where: { id: run.id },
    data: {
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : new Date(),
      postsCollected: run.postsCollected,
      error: run.error,
    },
  });
}

/** Persist a batch of social posts, skipping duplicates */
export async function savePosts(posts: SocialPost[], runId: string): Promise<number> {
  let saved = 0;
  for (const post of posts) {
    try {
      const authorId = await upsertUser(post.author);
      await prisma.socialPost.upsert({
        where: { platform_platformId: { platform: post.platform, platformId: post.platformId } },
        create: {
          platformId: post.platformId,
          platform: post.platform,
          url: post.url,
          content: post.content,
          rawContent: post.rawContent,
          publishedAt: new Date(post.publishedAt),
          collectedAt: new Date(post.collectedAt),
          likeCount: post.likeCount,
          shareCount: post.shareCount,
          commentCount: post.commentCount,
          tags: JSON.stringify(post.tags),
          metadata: post.metadata ? JSON.stringify(post.metadata) : undefined,
          authorId,
          runId,
        },
        update: {
          likeCount: post.likeCount,
          shareCount: post.shareCount,
          commentCount: post.commentCount,
        },
      });
      saved++;
    } catch {
      // skip individual post errors to allow the rest of the batch to save
    }
  }
  return saved;
}

export { PrismaClient };
