import { describe, it, expect, beforeEach } from "vitest";
import { isLoginPage } from "../src/content";

beforeEach(() => {
  // Reset to a neutral path and empty body before each test
  window.history.pushState({}, "", "/");
  document.body.innerHTML = "";
});

// ─── Heuristic 1: URL path ────────────────────────────────────────────────────

describe("Heuristic 1 — URL path", () => {
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/auth",
    "/oauth",
    "/sso",
    "/account/login",
  ]) {
    it(`returns true for ${path}`, () => {
      window.history.pushState({}, "", path);
      expect(isLoginPage()).toBe(true);
    });
  }

  it("returns true when pattern appears as a prefix (e.g. /login?next=/)", () => {
    window.history.pushState({}, "", "/login?next=/dashboard");
    expect(isLoginPage()).toBe(true);
  });

  it("returns false for a neutral path", () => {
    window.history.pushState({}, "", "/home");
    expect(isLoginPage()).toBe(false);
  });
});

// ─── Heuristic 2: Social sign-in buttons ─────────────────────────────────────

describe("Heuristic 2 — social sign-in buttons", () => {
  it("returns true for <button>Sign in with Google</button>", () => {
    document.body.innerHTML = "<button>Sign in with Google</button>";
    expect(isLoginPage()).toBe(true);
  });

  it("returns true for <a>Sign in with GitHub</a>", () => {
    document.body.innerHTML = "<a>Sign in with GitHub</a>";
    expect(isLoginPage()).toBe(true);
  });

  it("returns true for <div role='button'>Sign in with Apple</div>", () => {
    document.body.innerHTML = "<div role='button'>Sign in with Apple</div>";
    expect(isLoginPage()).toBe(true);
  });

  it("returns true for mixed-case text (SIGN IN WITH MICROSOFT)", () => {
    document.body.innerHTML = "<button>SIGN IN WITH MICROSOFT</button>";
    expect(isLoginPage()).toBe(true);
  });

  it("returns true for extra spaces between words", () => {
    document.body.innerHTML = "<button>Sign  in  with  Facebook</button>";
    expect(isLoginPage()).toBe(true);
  });

  it("returns false for unrelated button text", () => {
    document.body.innerHTML = "<button>Submit form</button>";
    expect(isLoginPage()).toBe(false);
  });
});

// ─── Heuristic 3: Email + password inputs ─────────────────────────────────────

describe("Heuristic 3 — email + password inputs", () => {
  it('returns true for input[type="email"] + input[type="password"]', () => {
    document.body.innerHTML =
      '<input type="email" /><input type="password" />';
    expect(isLoginPage()).toBe(true);
  });

  it('returns true for input[name="email"] + password', () => {
    document.body.innerHTML =
      '<input name="email" /><input type="password" />';
    expect(isLoginPage()).toBe(true);
  });

  it('returns true for input[name="username"] + password', () => {
    document.body.innerHTML =
      '<input name="username" /><input type="password" />';
    expect(isLoginPage()).toBe(true);
  });

  it('returns true for input[autocomplete="email"] + password', () => {
    document.body.innerHTML =
      '<input autocomplete="email" /><input type="password" />';
    expect(isLoginPage()).toBe(true);
  });

  it("returns true for partial name match (name*=email) + password", () => {
    document.body.innerHTML =
      '<input name="my_email_address" /><input type="password" />';
    expect(isLoginPage()).toBe(true);
  });

  it("returns false for email input alone (no password)", () => {
    document.body.innerHTML = '<input type="email" />';
    expect(isLoginPage()).toBe(false);
  });

  it("returns false for password input alone (no email)", () => {
    document.body.innerHTML = '<input type="password" />';
    expect(isLoginPage()).toBe(false);
  });

  it("returns false for empty DOM with neutral path", () => {
    expect(isLoginPage()).toBe(false);
  });
});
