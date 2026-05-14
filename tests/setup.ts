import { vi, beforeEach } from "vitest";

// ─── Chrome API stub ──────────────────────────────────────────────────────────

const chromeMock = {
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    lastError: undefined as { message: string } | undefined,
  },
  tabs: {
    query: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
    },
  },
};

// @ts-expect-error — chrome global is not available in jsdom
globalThis.chrome = chromeMock;

// ─── Minimal DOM for popup render() calls ─────────────────────────────────────

document.body.innerHTML =
  '<div id="main-content"></div><div id="domain-label"></div>';

// ─── Reset mocks before every test ───────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Restore default implementations after clearAllMocks clears call records
  // (clearAllMocks does NOT reset implementations, but we re-set them
  //  explicitly so tests that override them don't bleed into subsequent tests)
  chromeMock.tabs.query.mockImplementation(
    (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([])
  );
  chromeMock.runtime.sendMessage.mockImplementation(
    (_: unknown, cb?: (response: unknown) => void) => {
      cb?.({ detected: false });
    }
  );
});
