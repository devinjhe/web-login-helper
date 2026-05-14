import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase singleton — factory bypasses the env-var check in supabase.ts
vi.mock("../src/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../src/lib/supabase";
import {
  getLoginsForDomain,
  addLogin,
  updateLogin,
  deleteLogin,
} from "../src/lib/storage";
import type { Login } from "../src/lib/storage";

// ─── Chainable builder factory ────────────────────────────────────────────────

function makeBuilder(result: { data: unknown; error: { message: string } | null }) {
  // The builder is thenable so that `await builder` resolves to `result`.
  // This covers chains that end without an explicit terminal (e.g. deleteLogin ends with .eq()).
  const b: any = {
    then: (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => Promise.resolve(result)); // getLoginsForDomain ends here
  b.insert = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.delete = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(result)); // addLogin / updateLogin end here
  return b as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

const sampleLogin: Login = {
  id: "uuid-1",
  domain: "github.com",
  method: "GitHub",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getLoginsForDomain ────────────────────────────────────────────────────────

describe("getLoginsForDomain", () => {
  it("returns Login[] on success", async () => {
    const builder = makeBuilder({ data: [sampleLogin], error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    const result = await getLoginsForDomain("github.com");
    expect(result).toEqual([sampleLogin]);
  });

  it("returns [] when data is null", async () => {
    const builder = makeBuilder({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    const result = await getLoginsForDomain("github.com");
    expect(result).toEqual([]);
  });

  it("throws Error on Supabase error", async () => {
    const builder = makeBuilder({ data: null, error: { message: "DB error" } });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await expect(getLoginsForDomain("github.com")).rejects.toThrow("DB error");
  });

  it("calls .eq() with ('domain', <domain>)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await getLoginsForDomain("github.com");
    expect(builder.eq).toHaveBeenCalledWith("domain", "github.com");
  });
});

// ─── addLogin ─────────────────────────────────────────────────────────────────

describe("addLogin", () => {
  it("returns Login on success", async () => {
    const builder = makeBuilder({ data: sampleLogin, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    const result = await addLogin("github.com", "GitHub");
    expect(result).toEqual(sampleLogin);
  });

  it("passes identifier and notes when provided", async () => {
    const builder = makeBuilder({ data: sampleLogin, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await addLogin("github.com", "GitHub", "user@example.com", "some notes");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "user@example.com", notes: "some notes" })
    );
  });

  it("passes undefined for identifier and notes when omitted", async () => {
    const builder = makeBuilder({ data: sampleLogin, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await addLogin("github.com", "GitHub");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: undefined, notes: undefined })
    );
  });

  it("throws on Supabase error", async () => {
    const builder = makeBuilder({ data: null, error: { message: "insert failed" } });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await expect(addLogin("github.com", "GitHub")).rejects.toThrow("insert failed");
  });
});

// ─── updateLogin ──────────────────────────────────────────────────────────────

describe("updateLogin", () => {
  it("returns updated Login on success", async () => {
    const updated = { ...sampleLogin, method: "Google" };
    const builder = makeBuilder({ data: updated, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    const result = await updateLogin("uuid-1", { method: "Google" });
    expect(result).toEqual(updated);
  });

  it("includes updated_at in the update payload", async () => {
    const builder = makeBuilder({ data: sampleLogin, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await updateLogin("uuid-1", { method: "Google" });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: expect.any(String) })
    );
  });

  it("throws on Supabase error", async () => {
    const builder = makeBuilder({ data: null, error: { message: "update failed" } });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await expect(updateLogin("uuid-1", { method: "Google" })).rejects.toThrow("update failed");
  });
});

// ─── deleteLogin ──────────────────────────────────────────────────────────────

describe("deleteLogin", () => {
  it("resolves to undefined on success", async () => {
    const builder = makeBuilder({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await expect(deleteLogin("id1")).resolves.toBeUndefined();
  });

  it("calls .eq('id', id)", async () => {
    const builder = makeBuilder({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await deleteLogin("id1");
    expect(builder.eq).toHaveBeenCalledWith("id", "id1");
  });

  it("throws on Supabase error", async () => {
    const builder = makeBuilder({ data: null, error: { message: "delete failed" } });
    vi.mocked(supabase.from).mockReturnValue(builder as any);

    await expect(deleteLogin("id1")).rejects.toThrow("delete failed");
  });
});
