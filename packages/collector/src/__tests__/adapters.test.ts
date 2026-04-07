import { AdapterRegistry, GrokAdapter, TwitterAdapter, RedditAdapter } from "../adapters";
import type { AdapterConfig } from "../adapters";

describe("AdapterRegistry", () => {
  it("registers built-in adapters", () => {
    const registry = new AdapterRegistry();
    const names = registry.list();
    expect(names).toContain("grok");
    expect(names).toContain("twitter");
    expect(names).toContain("reddit");
  });

  it("retrieves adapter by name", () => {
    const registry = new AdapterRegistry();
    const adapter = registry.get("grok");
    expect(adapter).toBeInstanceOf(GrokAdapter);
  });

  it("throws for unknown adapter", () => {
    const registry = new AdapterRegistry();
    expect(() => registry.get("nonexistent")).toThrow(/not found/);
  });

  it("allows custom adapter registration", () => {
    const registry = new AdapterRegistry([]);
    const custom = new GrokAdapter();
    registry.register(custom);
    expect(registry.list()).toContain("grok");
  });
});

describe("BaseAdapter.validateConfig", () => {
  const grok = new GrokAdapter();
  const config: AdapterConfig = { apiKey: "test-key" };

  it("passes validation with required keys present", () => {
    expect(() => (grok as any).validateConfig(config)).not.toThrow();
  });

  it("throws when required key is missing", () => {
    expect(() => (grok as any).validateConfig({})).toThrow(/Missing required config key/);
  });

  it("throws when required key is empty string", () => {
    expect(() => (grok as any).validateConfig({ apiKey: "" })).toThrow(/Missing required config key/);
  });
});

describe("RedditAdapter (no required API key)", () => {
  const adapter = new RedditAdapter();

  it("has empty requiredConfigKeys", () => {
    expect(adapter.requiredConfigKeys).toHaveLength(0);
  });

  it("does not throw validateConfig with empty config", () => {
    expect(() => (adapter as any).validateConfig({})).not.toThrow();
  });
});

describe("TwitterAdapter", () => {
  const adapter = new TwitterAdapter();

  it("has name 'twitter'", () => {
    expect(adapter.name).toBe("twitter");
  });

  it("requires apiKey", () => {
    expect(adapter.requiredConfigKeys).toContain("apiKey");
  });
});

describe("GrokAdapter", () => {
  const adapter = new GrokAdapter();

  it("has name 'grok'", () => {
    expect(adapter.name).toBe("grok");
  });

  it("requires apiKey", () => {
    expect(adapter.requiredConfigKeys).toContain("apiKey");
  });
});
