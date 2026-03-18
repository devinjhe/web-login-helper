import { getLoginsForDomain, addLogin, updateLogin, deleteLogin, type Login } from "../lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "has-logins"; domain: string; logins: Login[]; showForm: boolean }
  | { kind: "prompt"; domain: string; loginPageDetected: boolean }
  | { kind: "empty"; domain: string }
  | { kind: "confirm-delete"; loginId: string; loginMethod: string; prevState: AppState }
  | { kind: "edit-login"; login: Login; prevState: AppState };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function getCurrentDomain(): Promise<string> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      resolve(extractDomain(url));
    });
  });
}

async function isLoginPageDetected(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_LOGIN_PAGE_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(response?.detected === true);
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function datesAreDifferent(created: string, updated: string): boolean {
  return Math.abs(new Date(updated).getTime() - new Date(created).getTime()) > 60_000;
}

// ─── Render functions ─────────────────────────────────────────────────────────

function renderLoading(): string {
  return `<div class="loading">Loading…</div>`;
}

function renderError(message: string): string {
  return `<div class="error-banner">⚠ ${message}</div>`;
}

function renderLoginList(logins: Login[], domain: string, showForm: boolean): string {
  const items = logins
    .map(
      (l) => `
      <div class="login-item" data-id="${l.id}">
        <div class="login-item-info">
          <span class="login-method">${escapeHtml(l.method)}</span>
          ${l.identifier ? `<span class="login-identifier">${escapeHtml(l.identifier)}</span>` : ""}
          ${l.notes ? `<span class="login-notes">${escapeHtml(l.notes)}</span>` : ""}
          <span class="login-dates">Added ${new Date(l.created_at).toLocaleDateString()}${datesAreDifferent(l.created_at, l.updated_at) ? ` · Edited ${new Date(l.updated_at).toLocaleDateString()}` : ""}</span>
        </div>
        <div class="login-item-actions">
          <button class="btn-icon edit" data-action="edit" data-id="${l.id}" title="Edit">✎</button>
          <button class="btn-icon delete" data-action="delete" data-id="${l.id}" title="Delete">✕</button>
        </div>
      </div>`
    )
    .join("");

  const form = showForm ? renderForm() : "";

  return `
    <div class="login-list">${items}</div>
    ${
      showForm
        ? form
        : `<button class="btn-add-another" data-action="show-form">+ Add another</button>`
    }
  `;
}

function renderConfirmDelete(loginId: string, loginMethod: string): string {
  return `
    <div class="confirm-delete-strip">
      <span class="confirm-delete-text">Delete <strong>${escapeHtml(loginMethod)}</strong>?</span>
      <div class="confirm-delete-actions">
        <button class="btn-secondary btn-sm" data-action="cancel-delete">Cancel</button>
        <button class="btn-danger btn-sm" data-action="confirm-delete" data-id="${loginId}">Delete</button>
      </div>
    </div>
  `;
}

function renderPrompt(domain: string, loginPageDetected: boolean): string {
  const banner = loginPageDetected
    ? `<div class="detection-banner">🔑 Login page detected for <strong>${escapeHtml(domain)}</strong></div>`
    : "";

  return `
    ${banner}
    <div class="prompt-section">
      <p class="prompt-title">How do you log in here?</p>
      <p class="prompt-subtitle">Choose a method to save for ${escapeHtml(domain)}</p>
      ${renderForm()}
    </div>
  `;
}

function renderEmpty(domain: string): string {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">🔐</div>
      <p class="empty-state-text">No saved logins for<br><strong>${escapeHtml(domain)}</strong></p>
      <button class="btn-add-login" data-action="show-prompt">+ Add login for this site</button>
    </div>
  `;
}

function renderForm(login?: Login): string {
  const methods = ["Google", "GitHub", "Apple", "Email", "Microsoft", "Other"];
  const options = methods
    .map((m) => `<option value="${m}"${login?.method === m ? " selected" : ""}>${m}</option>`)
    .join("");
  const saveAction = login ? `save-edit" data-id="${login.id}` : "save-login";

  return `
    <div class="add-form">
      <div class="form-group">
        <label for="method-select">Login method</label>
        <select id="method-select" name="method">
          <option value="">Select method…</option>
          ${options}
        </select>
      </div>
      <div class="form-group">
        <label for="identifier-input">Email / username <span style="color:#9ca3af;font-weight:400">(optional)</span></label>
        <input type="text" id="identifier-input" name="identifier" placeholder="you@example.com" value="${escapeHtml(login?.identifier ?? "")}" />
      </div>
      <div class="form-group">
        <label for="notes-input">Notes <span style="color:#9ca3af;font-weight:400">(optional)</span></label>
        <textarea id="notes-input" name="notes" placeholder="Any extra context…">${escapeHtml(login?.notes ?? "")}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn-primary" data-action="${saveAction}">Save</button>
      </div>
    </div>
  `;
}

// ─── App ──────────────────────────────────────────────────────────────────────

let currentState: AppState = { kind: "loading" };
let currentDomain = "";

function setState(state: AppState) {
  currentState = state;
  render();
}

function render() {
  const main = document.getElementById("main-content")!;
  const domainLabel = document.getElementById("domain-label")!;

  domainLabel.textContent = currentDomain || "";

  switch (currentState.kind) {
    case "loading":
      main.innerHTML = renderLoading();
      break;
    case "error":
      main.innerHTML = renderError(currentState.message);
      break;
    case "has-logins":
      main.innerHTML = renderLoginList(
        currentState.logins,
        currentState.domain,
        currentState.showForm
      );
      break;
    case "prompt":
      main.innerHTML = renderPrompt(currentState.domain, currentState.loginPageDetected);
      break;
    case "empty":
      main.innerHTML = renderEmpty(currentState.domain);
      break;
    case "confirm-delete":
      main.innerHTML = renderConfirmDelete(currentState.loginId, currentState.loginMethod);
      break;
    case "edit-login":
      main.innerHTML = renderForm(currentState.login);
      break;
  }
}

async function loadData() {
  setState({ kind: "loading" });

  try {
    const domain = await getCurrentDomain();
    currentDomain = domain;

    const [logins, loginDetected] = await Promise.all([
      getLoginsForDomain(domain),
      isLoginPageDetected(),
    ]);

    if (logins.length > 0) {
      setState({ kind: "has-logins", domain, logins, showForm: false });
    } else if (loginDetected) {
      setState({ kind: "prompt", domain, loginPageDetected: true });
    } else {
      setState({ kind: "empty", domain });
    }
  } catch (err) {
    setState({ kind: "error", message: String(err) });
  }
}

async function handleSave() {
  const methodEl = document.getElementById("method-select") as HTMLSelectElement;
  const identifierEl = document.getElementById("identifier-input") as HTMLInputElement;
  const notesEl = document.getElementById("notes-input") as HTMLTextAreaElement;
  const saveBtn = document.querySelector('[data-action="save-login"]') as HTMLButtonElement;

  const method = methodEl?.value;
  if (!method) {
    methodEl?.focus();
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    await addLogin(
      currentDomain,
      method,
      identifierEl?.value || undefined,
      notesEl?.value || undefined
    );
    chrome.runtime.sendMessage({ type: "CLEAR_BADGE" });
    await loadData();
  } catch (err) {
    const main = document.getElementById("main-content")!;
    main.insertAdjacentHTML("afterbegin", renderError(`Failed to save: ${String(err)}`));
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

async function handleUpdate(id: string) {
  const methodEl = document.getElementById("method-select") as HTMLSelectElement;
  const identifierEl = document.getElementById("identifier-input") as HTMLInputElement;
  const notesEl = document.getElementById("notes-input") as HTMLTextAreaElement;
  const saveBtn = document.querySelector('[data-action="save-edit"]') as HTMLButtonElement;

  const method = methodEl?.value;
  if (!method) {
    methodEl?.focus();
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    await updateLogin(id, {
      method,
      identifier: identifierEl?.value || undefined,
      notes: notesEl?.value || undefined,
    });
    await loadData();
  } catch (err) {
    const main = document.getElementById("main-content")!;
    main.insertAdjacentHTML("afterbegin", renderError(`Failed to update: ${String(err)}`));
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

async function handleDelete(id: string) {
  try {
    await deleteLogin(id);
    await loadData();
  } catch (err) {
    const main = document.getElementById("main-content")!;
    main.insertAdjacentHTML("afterbegin", renderError(`Failed to delete: ${String(err)}`));
  }
}

// ─── Event delegation ─────────────────────────────────────────────────────────

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const action = target.dataset.action;

  if (!action) return;

  switch (action) {
    case "delete": {
      const id = target.dataset.id;
      if (!id) break;
      if (currentState.kind === "has-logins") {
        const login = currentState.logins.find((l) => l.id === id);
        if (login) {
          setState({ kind: "confirm-delete", loginId: id, loginMethod: login.method, prevState: currentState });
        }
      }
      break;
    }
    case "confirm-delete": {
      const id = target.dataset.id;
      if (id) handleDelete(id);
      break;
    }
    case "cancel-delete": {
      if (currentState.kind === "confirm-delete") {
        setState(currentState.prevState);
      }
      break;
    }
    case "edit": {
      const id = target.dataset.id;
      if (!id) break;
      if (currentState.kind === "has-logins") {
        const login = currentState.logins.find((l) => l.id === id);
        if (login) {
          setState({ kind: "edit-login", login, prevState: currentState });
        }
      }
      break;
    }
    case "save-edit": {
      const id = target.dataset.id;
      if (id) handleUpdate(id);
      break;
    }
    case "show-form": {
      if (currentState.kind === "has-logins") {
        setState({ ...currentState, showForm: true });
      }
      break;
    }
    case "show-prompt": {
      if (currentState.kind === "empty") {
        setState({ kind: "prompt", domain: currentState.domain, loginPageDetected: false });
      }
      break;
    }
    case "save-login": {
      handleSave();
      break;
    }
    case "cancel": {
      if (currentState.kind === "has-logins") {
        setState({ ...currentState, showForm: false });
      } else if (currentState.kind === "edit-login") {
        setState(currentState.prevState);
      } else {
        setState({ kind: "empty", domain: currentDomain });
      }
      break;
    }
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadData();
