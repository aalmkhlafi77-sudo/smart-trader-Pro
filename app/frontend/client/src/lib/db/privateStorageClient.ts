import type { BackupPayload } from "./repository";
import {
  indexedDbRepository,
  setIndexedDbNamespace,
} from "./indexedDbRepository";

export type PrivateStorageState = {
  ready: boolean;
  databaseReady: boolean;
  authenticated: boolean;
  username: string;
  csrfToken: string;
  revision: number;
  hasSnapshot: boolean;
  updatedAt: string | null;
  syncState: "idle" | "syncing" | "error" | "conflict";
  lastError: string;
};

const initialState: PrivateStorageState = {
  ready: false,
  databaseReady: false,
  authenticated: false,
  username: "",
  csrfToken: "",
  revision: 0,
  hasSnapshot: false,
  updatedAt: null,
  syncState: "idle",
  lastError: "",
};

let state: PrivateStorageState = { ...initialState };
let syncSuspended = 0;
let syncQueue: Promise<void> = Promise.resolve();
const listeners = new Set<(next: PrivateStorageState) => void>();

function emit(patch: Partial<PrivateStorageState>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener(state));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(body?.error || response.statusText));
    (error as Error & { status?: number; payload?: unknown }).status = response.status;
    (error as Error & { status?: number; payload?: unknown }).payload = body;
    throw error;
  }
  return body as T;
}

export function getPrivateStorageState() {
  return state;
}

export function subscribePrivateStorage(
  listener: (next: PrivateStorageState) => void
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function hydratePrivateCache() {
  if (!state.authenticated) return;
  const snapshot = await request<{
    revision: number;
    payload: BackupPayload | null;
    updatedAt: string | null;
  }>("/api/private/snapshot");
  emit({
    revision: snapshot.revision,
    hasSnapshot: Boolean(snapshot.payload),
    updatedAt: snapshot.updatedAt,
  });

  syncSuspended += 1;
  try {
    setIndexedDbNamespace("private");
    if (snapshot.payload) {
      await indexedDbRepository.importBackup(snapshot.payload, "replace");
    } else {
      await indexedDbRepository.clearAll();
      await indexedDbRepository.init();
    }
  } finally {
    syncSuspended -= 1;
  }
}

export async function initializePrivateStorageClient() {
  try {
    const status = await request<{
      databaseReady: boolean;
      authenticated: boolean;
      username?: string;
      csrfToken?: string;
      revision?: number;
      hasSnapshot?: boolean;
      updatedAt?: string | null;
    }>("/api/private/status");

    if (status.authenticated) {
      emit({
        ready: false,
        databaseReady: true,
        authenticated: true,
        username: status.username || "",
        csrfToken: status.csrfToken || "",
        revision: Number(status.revision || 0),
        hasSnapshot: Boolean(status.hasSnapshot),
        updatedAt: status.updatedAt || null,
      });
      await hydratePrivateCache();
    } else {
      setIndexedDbNamespace("public");
      emit({
        ...initialState,
        ready: true,
        databaseReady: status.databaseReady,
      });
      return;
    }
    emit({ ready: true });
  } catch (error) {
    setIndexedDbNamespace("public");
    emit({
      ...initialState,
      ready: true,
      lastError: error instanceof Error ? error.message : "PRIVATE_STATUS_FAILED",
    });
  }
}

export async function loginPrivateStorage(username: string, password: string) {
  const login = await request<{
    authenticated: true;
    username: string;
    csrfToken: string;
    revision: number;
    hasSnapshot: boolean;
    updatedAt: string | null;
  }>("/api/private/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  emit({
    ready: false,
    databaseReady: true,
    authenticated: true,
    username: login.username,
    csrfToken: login.csrfToken,
    revision: login.revision,
    hasSnapshot: login.hasSnapshot,
    updatedAt: login.updatedAt,
    syncState: "idle",
    lastError: "",
  });
  await hydratePrivateCache();
  emit({ ready: true });
}

export async function logoutPrivateStorage() {
  await flushPrivateStorageSync();
  try {
    await request<{ ok: true }>("/api/private/logout", {
      method: "POST",
      body: "{}",
    });
  } finally {
    setIndexedDbNamespace("public");
    emit({ ...initialState, ready: true, databaseReady: state.databaseReady });
  }
}

async function syncSnapshotNow() {
  if (!state.authenticated || syncSuspended > 0) return;
  emit({ syncState: "syncing", lastError: "" });
  const payload = await indexedDbRepository.exportBackup();
  try {
    const result = await request<{ revision: number; updatedAt: string }>(
      "/api/private/snapshot",
      {
        method: "PUT",
        headers: { "x-csrf-token": state.csrfToken },
        body: JSON.stringify({
          expectedRevision: state.revision,
          payload,
        }),
      }
    );
    emit({
      revision: result.revision,
      hasSnapshot: true,
      updatedAt: result.updatedAt,
      syncState: "idle",
      lastError: "",
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    emit({
      syncState: status === 409 ? "conflict" : "error",
      lastError: error instanceof Error ? error.message : "PRIVATE_SYNC_FAILED",
    });
    throw error;
  }
}

export function queuePrivateStorageSync() {
  if (!state.authenticated || syncSuspended > 0) return;
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(syncSnapshotNow)
    .catch(() => undefined);
}

export async function flushPrivateStorageSync() {
  if (!state.authenticated || syncSuspended > 0) return;
  queuePrivateStorageSync();
  await syncQueue;
}

export async function reloadPrivateStorageFromServer() {
  if (!state.authenticated) return;
  await hydratePrivateCache();
  emit({ syncState: "idle", lastError: "" });
}
