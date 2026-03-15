// Content script: detect login pages and notify the background service worker

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isLoginPage(): boolean {
  const url = window.location.href.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  // Heuristic 1: URL path contains known login patterns
  const loginPaths = ["/login", "/signin", "/sign-in", "/auth", "/oauth", "/sso", "/account/login"];
  if (loginPaths.some((p) => path.includes(p))) {
    return true;
  }

  // Heuristic 2: Page has social sign-in buttons
  const buttonTexts = document.querySelectorAll("button, a, [role='button']");
  const socialPattern = /sign\s+in\s+with\s+(google|github|apple|microsoft|facebook)/i;
  for (const el of buttonTexts) {
    if (socialPattern.test(el.textContent ?? "")) {
      return true;
    }
  }

  // Heuristic 3: Page has both an email input and a password input
  const hasEmail = !!document.querySelector(
    'input[type="email"], input[name*="email"], input[name*="username"], input[autocomplete*="email"]'
  );
  const hasPassword = !!document.querySelector('input[type="password"]');
  if (hasEmail && hasPassword) {
    return true;
  }

  return false;
}

// Run detection after DOM is ready
function runDetection() {
  if (!isLoginPage()) return;

  const domain = extractDomain(window.location.href);
  chrome.runtime.sendMessage({ type: "LOGIN_PAGE_DETECTED", domain });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runDetection);
} else {
  runDetection();
}
