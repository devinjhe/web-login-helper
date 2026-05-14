import { describe, it, expect, vi, afterEach } from "vitest";

// Importing the background module triggers its module-level addListener registrations.
// The chrome mock is already in place (setup.ts runs before this file is evaluated).
import "../src/background";

// Capture listener callbacks NOW — before vi.clearAllMocks() (called in beforeEach
// by setup.ts) clears mock.calls. The callback references remain valid after clearing.
const onMessageMock = chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>;
const onUpdatedMock = chrome.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>;
const onRemovedMock = chrome.tabs.onRemoved.addListener as ReturnType<typeof vi.fn>;

// handler1: handles LOGIN_PAGE_DETECTED and CLEAR_BADGE
const handler1 = onMessageMock.mock.calls[0][0] as (
  message: { type: string; domain?: string },
  sender: { tab?: { id?: number } }
) => void;

// handler2: handles GET_LOGIN_PAGE_STATE — returns true to keep channel open
const handler2 = onMessageMock.mock.calls[1][0] as (
  message: { type: string },
  sender: unknown,
  sendResponse: (r: { detected: boolean }) => void
) => boolean;

const onUpdated = onUpdatedMock.mock.calls[0][0] as (
  tabId: number,
  changeInfo: { status?: string }
) => void;

const onRemoved = onRemovedMock.mock.calls[0][0] as (tabId: number) => void;

const TEST_TAB = 42;

afterEach(() => {
  // Clean up loginPageTabs Set — onUpdated with status:"loading" removes the tab
  onUpdated(TEST_TAB, { status: "loading" });
  onUpdated(1, { status: "loading" });
});

// ─── LOGIN_PAGE_DETECTED ──────────────────────────────────────────────────────

describe("LOGIN_PAGE_DETECTED", () => {
  it("calls setBadgeText with '!' for the sender tab", () => {
    handler1({ type: "LOGIN_PAGE_DETECTED", domain: "example.com" }, { tab: { id: TEST_TAB } });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "!", tabId: TEST_TAB });
  });

  it("calls setBadgeBackgroundColor with amber for the sender tab", () => {
    handler1({ type: "LOGIN_PAGE_DETECTED", domain: "example.com" }, { tab: { id: TEST_TAB } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#f59e0b",
      tabId: TEST_TAB,
    });
  });

  it("does not set badge when sender.tab is undefined", () => {
    handler1({ type: "LOGIN_PAGE_DETECTED", domain: "example.com" }, {});
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
  });
});

// ─── CLEAR_BADGE ─────────────────────────────────────────────────────────────

describe("CLEAR_BADGE", () => {
  it("queries the active tab and clears the badge", () => {
    vi.mocked(chrome.tabs.query).mockImplementationOnce(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([{ id: TEST_TAB } as chrome.tabs.Tab])
    );

    handler1({ type: "CLEAR_BADGE" }, {});
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: TEST_TAB });
  });

  it("removes tab from set (subsequent GET_LOGIN_PAGE_STATE → detected:false)", () => {
    // First add the tab
    handler1({ type: "LOGIN_PAGE_DETECTED" }, { tab: { id: TEST_TAB } });

    // Clear it
    vi.mocked(chrome.tabs.query).mockImplementation(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([{ id: TEST_TAB } as chrome.tabs.Tab])
    );
    handler1({ type: "CLEAR_BADGE" }, {});

    // Now GET_LOGIN_PAGE_STATE should report not detected
    const sendResponse = vi.fn();
    handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ detected: false });
  });
});

// ─── GET_LOGIN_PAGE_STATE ─────────────────────────────────────────────────────

describe("GET_LOGIN_PAGE_STATE", () => {
  it("sendResponse({detected:true}) when tab is in set", () => {
    // Add tab to set
    handler1({ type: "LOGIN_PAGE_DETECTED" }, { tab: { id: TEST_TAB } });

    // Make tabs.query return that tab
    vi.mocked(chrome.tabs.query).mockImplementationOnce(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([{ id: TEST_TAB } as chrome.tabs.Tab])
    );

    const sendResponse = vi.fn();
    handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ detected: true });
  });

  it("sendResponse({detected:false}) when tab is not in set", () => {
    vi.mocked(chrome.tabs.query).mockImplementationOnce(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([{ id: 999 } as chrome.tabs.Tab])
    );

    const sendResponse = vi.fn();
    handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ detected: false });
  });

  it("sendResponse({detected:false}) when tabs.query returns []", () => {
    // Default mock already returns []
    const sendResponse = vi.fn();
    handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ detected: false });
  });

  it("handler returns true (keeps message channel open)", () => {
    const retVal = handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, vi.fn());
    expect(retVal).toBe(true);
  });
});

// ─── chrome.tabs.onUpdated ────────────────────────────────────────────────────

describe("chrome.tabs.onUpdated", () => {
  it("status=loading clears the badge and removes the tab from set", () => {
    // Add tab first
    handler1({ type: "LOGIN_PAGE_DETECTED" }, { tab: { id: TEST_TAB } });
    vi.clearAllMocks(); // reset call records to check only onUpdated side-effects

    onUpdated(TEST_TAB, { status: "loading" });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: TEST_TAB });

    // Tab should no longer be in set
    vi.mocked(chrome.tabs.query).mockImplementationOnce(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([{ id: TEST_TAB } as chrome.tabs.Tab])
    );
    const sendResponse = vi.fn();
    handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ detected: false });
  });

  it("status=complete does nothing", () => {
    onUpdated(TEST_TAB, { status: "complete" });
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
  });

  it("does not throw for an unknown tabId", () => {
    expect(() => onUpdated(99999, { status: "loading" })).not.toThrow();
  });
});

// ─── chrome.tabs.onRemoved ────────────────────────────────────────────────────

describe("chrome.tabs.onRemoved", () => {
  it("removes tab from set", () => {
    handler1({ type: "LOGIN_PAGE_DETECTED" }, { tab: { id: TEST_TAB } });
    onRemoved(TEST_TAB);

    vi.mocked(chrome.tabs.query).mockImplementationOnce(
      (_: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([{ id: TEST_TAB } as chrome.tabs.Tab])
    );
    const sendResponse = vi.fn();
    handler2({ type: "GET_LOGIN_PAGE_STATE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ detected: false });
  });

  it("does not throw for an unknown tabId", () => {
    expect(() => onRemoved(99999)).not.toThrow();
  });
});
