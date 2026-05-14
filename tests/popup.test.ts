import { describe, it, expect, vi } from "vitest";

// Mock storage so the module-level loadData() in popup.ts resolves quickly
// (vi.mock is hoisted before imports by Vitest)
vi.mock("../src/lib/storage", () => ({
  getLoginsForDomain: vi.fn().mockResolvedValue([]),
  addLogin: vi.fn(),
  updateLogin: vi.fn(),
  deleteLogin: vi.fn(),
}));

import {
  extractDomain,
  escapeHtml,
  datesAreDifferent,
  renderForm,
  renderConfirmDelete,
  renderLoginList,
  renderPrompt,
  renderEmpty,
} from "../src/popup/popup";
import type { Login } from "../src/lib/storage";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_DATE = "2024-01-01T00:00:00.000Z";
const SAME_DATE = "2024-01-01T00:00:00.000Z";
const DIFF_61S = "2024-01-01T00:01:01.000Z"; // 61 s later → different
const DIFF_60S = "2024-01-01T00:01:00.000Z"; // exactly 60 s → NOT different
const DIFF_59S = "2024-01-01T00:00:59.000Z"; // 59 s later → NOT different

function makeLogin(overrides: Partial<Login> = {}): Login {
  return {
    id: "id1",
    domain: "example.com",
    method: "Google",
    created_at: BASE_DATE,
    updated_at: SAME_DATE,
    ...overrides,
  };
}

// ─── extractDomain ─────────────────────────────────────────────────────────────

describe("extractDomain", () => {
  it("strips www.", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("leaves non-www hostname unchanged", () => {
    expect(extractDomain("https://example.com/path")).toBe("example.com");
  });

  it("returns input unchanged for an invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("not-a-url");
  });

  it("returns empty string for empty input", () => {
    expect(extractDomain("")).toBe("");
  });

  it("only strips leading www., preserving other subdomains", () => {
    expect(extractDomain("https://www.app.example.com")).toBe("app.example.com");
  });
});

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes &", () => expect(escapeHtml("a&b")).toBe("a&amp;b"));
  it("escapes <", () => expect(escapeHtml("a<b")).toBe("a&lt;b"));
  it("escapes >", () => expect(escapeHtml("a>b")).toBe("a&gt;b"));
  it('escapes "', () => expect(escapeHtml('a"b')).toBe("a&quot;b"));

  it("escapes all special chars combined", () => {
    expect(escapeHtml('<script src="x">&</script>')).toBe(
      "&lt;script src=&quot;x&quot;&gt;&amp;&lt;/script&gt;"
    );
  });

  it("passes plain strings through unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ─── datesAreDifferent ───────────────────────────────────────────────────────

describe("datesAreDifferent", () => {
  it("returns true when diff > 60 s", () => {
    expect(datesAreDifferent(BASE_DATE, DIFF_61S)).toBe(true);
  });

  it("returns false when diff is exactly 60 s", () => {
    expect(datesAreDifferent(BASE_DATE, DIFF_60S)).toBe(false);
  });

  it("returns false when diff < 60 s", () => {
    expect(datesAreDifferent(BASE_DATE, DIFF_59S)).toBe(false);
  });

  it("returns false for identical dates", () => {
    expect(datesAreDifferent(BASE_DATE, SAME_DATE)).toBe(false);
  });

  it("uses Math.abs — works with reversed argument order", () => {
    expect(datesAreDifferent(DIFF_61S, BASE_DATE)).toBe(true);
  });
});

// ─── renderForm (blank / add mode) ───────────────────────────────────────────

describe("renderForm — blank/add mode", () => {
  const html = renderForm();

  it("has a method <select>", () => {
    expect(html).toContain('<select');
    expect(html).toContain('name="method"');
  });

  it("contains all 6 method options plus placeholder", () => {
    for (const m of ["Google", "GitHub", "Apple", "Email", "Microsoft", "Other"]) {
      expect(html).toContain(`<option value="${m}">`);
    }
    expect(html).toContain('value=""');
  });

  it("no option is pre-selected", () => {
    expect(html).not.toContain(" selected");
  });

  it("save button has data-action=save-login", () => {
    expect(html).toContain('data-action="save-login"');
  });

  it("identifier input is empty", () => {
    expect(html).toContain('value=""');
  });

  it("notes textarea is empty", () => {
    // The textarea content between tags should be empty
    expect(html).toMatch(/<textarea[^>]*><\/textarea>/);
  });
});

// ─── renderForm (pre-filled / edit mode) ─────────────────────────────────────

describe("renderForm — pre-filled/edit mode", () => {
  it("pre-selects the correct method", () => {
    const html = renderForm(makeLogin({ method: "GitHub" }));
    expect(html).toContain('<option value="GitHub" selected>');
    expect(html).not.toContain('<option value="Google" selected>');
  });

  it("pre-fills identifier", () => {
    const html = renderForm(makeLogin({ identifier: "user@example.com" }));
    expect(html).toContain('value="user@example.com"');
  });

  it("pre-fills notes", () => {
    const html = renderForm(makeLogin({ notes: "my notes" }));
    expect(html).toContain(">my notes<");
  });

  it("save button has data-action=save-edit and matching data-id", () => {
    const html = renderForm(makeLogin({ id: "abc123" }));
    expect(html).toContain('data-action="save-edit"');
    expect(html).toContain('data-id="abc123"');
  });

  it("XSS: identifier with special chars is escaped", () => {
    const html = renderForm(makeLogin({ identifier: '<img src="x" onerror="alert(1)">' }));
    expect(html).not.toContain('<img');
    expect(html).toContain("&lt;img");
  });

  it("XSS: notes with special chars are escaped", () => {
    const html = renderForm(makeLogin({ notes: 'a & b < c > d "e"' }));
    expect(html).toContain("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });
});

// ─── renderConfirmDelete ──────────────────────────────────────────────────────

describe("renderConfirmDelete", () => {
  const html = renderConfirmDelete("login-id-1", "GitHub");

  it("shows the method name in a <strong>", () => {
    expect(html).toContain("<strong>GitHub</strong>");
  });

  it("cancel button has data-action=cancel-delete", () => {
    expect(html).toContain('data-action="cancel-delete"');
  });

  it("delete button has data-action=confirm-delete and data-id", () => {
    expect(html).toContain('data-action="confirm-delete"');
    expect(html).toContain('data-id="login-id-1"');
  });

  it("XSS: method is escaped", () => {
    const xss = renderConfirmDelete("id1", '<script>alert(1)</script>');
    expect(xss).not.toContain("<script>");
    expect(xss).toContain("&lt;script&gt;");
  });
});

// ─── renderLoginList ─────────────────────────────────────────────────────────

describe("renderLoginList", () => {
  it("renders one .login-item per login", () => {
    const logins = [makeLogin({ id: "a" }), makeLogin({ id: "b" })];
    const html = renderLoginList(logins, "example.com", false);
    const matches = html.match(/class="login-item"/g);
    expect(matches).toHaveLength(2);
  });

  it("shows method", () => {
    const html = renderLoginList([makeLogin({ method: "Apple" })], "example.com", false);
    expect(html).toContain("Apple");
  });

  it("shows identifier when set", () => {
    const html = renderLoginList([makeLogin({ identifier: "u@x.com" })], "example.com", false);
    expect(html).toContain("u@x.com");
  });

  it("omits identifier when absent", () => {
    const login = makeLogin();
    delete login.identifier;
    const html = renderLoginList([login], "example.com", false);
    expect(html).not.toContain("login-identifier");
  });

  it("shows notes when set", () => {
    const html = renderLoginList([makeLogin({ notes: "My note" })], "example.com", false);
    expect(html).toContain("My note");
  });

  it("omits notes when absent", () => {
    const login = makeLogin();
    delete login.notes;
    const html = renderLoginList([login], "example.com", false);
    expect(html).not.toContain("login-notes");
  });

  it('"Added [date]" is always present', () => {
    const html = renderLoginList([makeLogin()], "example.com", false);
    expect(html).toContain("Added ");
  });

  it('"· Edited" absent when dates are equal', () => {
    const html = renderLoginList([makeLogin()], "example.com", false);
    expect(html).not.toContain("· Edited");
  });

  it('"· Edited" present when diff > 60 s', () => {
    const html = renderLoginList(
      [makeLogin({ updated_at: DIFF_61S })],
      "example.com",
      false
    );
    expect(html).toContain("· Edited");
  });

  it('"· Edited" absent when diff is exactly 60 s', () => {
    const html = renderLoginList(
      [makeLogin({ updated_at: DIFF_60S })],
      "example.com",
      false
    );
    expect(html).not.toContain("· Edited");
  });

  it("edit button has data-action=edit and data-id", () => {
    const html = renderLoginList([makeLogin({ id: "xyz" })], "example.com", false);
    expect(html).toContain('data-action="edit" data-id="xyz"');
  });

  it("delete button has data-action=delete and data-id", () => {
    const html = renderLoginList([makeLogin({ id: "xyz" })], "example.com", false);
    expect(html).toContain('data-action="delete" data-id="xyz"');
  });

  it("showForm=false renders '+ Add another' button", () => {
    const html = renderLoginList([makeLogin()], "example.com", false);
    expect(html).toContain("+ Add another");
    expect(html).toContain('data-action="show-form"');
  });

  it("showForm=true renders the form inline", () => {
    const html = renderLoginList([makeLogin()], "example.com", true);
    expect(html).toContain("<select");
    expect(html).not.toContain("+ Add another");
  });

  it("XSS: method is escaped", () => {
    const html = renderLoginList(
      [makeLogin({ method: '<b onclick="x()">' })],
      "example.com",
      false
    );
    expect(html).not.toContain("<b ");
    expect(html).toContain("&lt;b");
  });
});

// ─── renderPrompt ─────────────────────────────────────────────────────────────

describe("renderPrompt", () => {
  it("shows detection banner when loginPageDetected=true", () => {
    const html = renderPrompt("example.com", true);
    expect(html).toContain("detection-banner");
    expect(html).toContain("Login page detected");
  });

  it("omits detection banner when loginPageDetected=false", () => {
    const html = renderPrompt("example.com", false);
    expect(html).not.toContain("detection-banner");
  });

  it("includes the form", () => {
    const html = renderPrompt("example.com", false);
    expect(html).toContain('<select');
    expect(html).toContain('data-action="save-login"');
  });

  it("XSS: domain is escaped in banner", () => {
    const html = renderPrompt('<script>alert(1)</script>', true);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("XSS: domain is escaped in subtitle", () => {
    const html = renderPrompt('<img src="x">', false);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

// ─── renderEmpty ──────────────────────────────────────────────────────────────

describe("renderEmpty", () => {
  it("renders the add-login button", () => {
    const html = renderEmpty("example.com");
    expect(html).toContain('data-action="show-prompt"');
  });

  it("shows the domain name", () => {
    const html = renderEmpty("example.com");
    expect(html).toContain("example.com");
  });

  it("XSS: domain is escaped", () => {
    const html = renderEmpty('<script>alert(1)</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
