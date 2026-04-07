import type { SocialPost, SocialUser, AnalysisResult, CollectionRun } from "../schema";

describe("Schema types", () => {
  it("constructs a valid SocialUser", () => {
    const user: SocialUser = {
      platformId: "u123",
      username: "testuser",
      platform: "twitter",
    };
    expect(user.platform).toBe("twitter");
    expect(user.platformId).toBe("u123");
  });

  it("constructs a valid SocialPost", () => {
    const user: SocialUser = {
      platformId: "u123",
      username: "testuser",
      platform: "reddit",
    };
    const post: SocialPost = {
      platformId: "p456",
      platform: "reddit",
      content: "Hello world",
      author: user,
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      tags: ["technology"],
    };
    expect(post.platform).toBe("reddit");
    expect(post.tags).toContain("technology");
  });

  it("constructs a valid CollectionRun", () => {
    const run: CollectionRun = {
      id: "run-1",
      source: "grok",
      startedAt: new Date().toISOString(),
      postsCollected: 5,
    };
    expect(run.source).toBe("grok");
    expect(run.error).toBeUndefined();
  });

  it("constructs a valid AnalysisResult", () => {
    const result: AnalysisResult = {
      id: "ar-1",
      collectionRunId: "run-1",
      analyzedAt: new Date().toISOString(),
      sentiments: {
        p456: { label: "positive", score: 0.9 },
      },
      trends: [{ topic: "AI", postCount: 3, avgSentiment: "positive" }],
      decisions: [
        {
          algorithm: "sentiment-trend",
          summary: "Positive trend detected",
          confidence: 0.85,
          decidedAt: new Date().toISOString(),
          payload: {},
        },
      ],
    };
    expect(result.decisions[0].algorithm).toBe("sentiment-trend");
    expect(result.sentiments["p456"].label).toBe("positive");
  });
});
