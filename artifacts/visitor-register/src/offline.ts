import { createVisitor, deleteVisitor, listVisitors } from '@workspace/api-client-react';
import type { Visitor, VisitorInput } from '@workspace/api-client-react';

const VISITORS_KEY = 'harbor.visitors.v1';
const QUEUE_KEY = 'harbor.sync-queue.v1';

type QueueItem =
  | { type: 'create'; localId: number; data: VisitorInput }
  | { type: 'delete'; id: number };

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the UI usable if local storage is temporarily unavailable/full.
  }
};

function getQueue(): QueueItem[] {
  return read<QueueItem[]>(QUEUE_KEY, []);
}

export function getLocalVisitors(): Visitor[] {
  return read<Visitor[]>(VISITORS_KEY, []);
}

export function saveLocalVisitors(visitors: Visitor[]) {
  write(VISITORS_KEY, visitors);
}

export function getLocalSummary() {
  const visitors = getLocalVisitors();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return {
    total: visitors.length,
    today: visitors.filter(v => new Date(v.checkedInAt).getTime() >= start).length,
    latestCheckIn: visitors[0]?.checkedInAt ?? null,
  };
}

export function addOfflineVisitor(data: VisitorInput): Visitor {
  const visitor: Visitor = {
    id: -Date.now(),
    ...data,
    checkedInAt: new Date().toISOString(),
  };
  saveLocalVisitors([visitor, ...getLocalVisitors()]);
  write(QUEUE_KEY, [...getQueue(), { type: 'create', localId: visitor.id, data }]);
  return visitor;
}

export function deleteLocalVisitor(id: number) {
  saveLocalVisitors(getLocalVisitors().filter(v => v.id !== id));
  const queue = getQueue();
  if (id < 0) {
    write(QUEUE_KEY, queue.filter(item => !(item.type === 'create' && item.localId === id)));
  } else {
    write(QUEUE_KEY, [...queue, { type: 'delete', id }]);
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status?: unknown }).status === 404;
}

export async function syncOfflineData() {
  if (!navigator.onLine) return;
  const queue = getQueue();
  if (!queue.length) return;

  const remaining: QueueItem[] = [];
  for (const item of queue) {
    try {
      if (item.type === 'create') {
        const created = await createVisitor(item.data);
        const current = getLocalVisitors();
        saveLocalVisitors(current.map(v => v.id === item.localId ? created : v));
      } else {
        try {
          await deleteVisitor(item.id);
        } catch (error) {
          // A record already removed on the server is successfully synced.
          if (!isNotFound(error)) throw error;
        }
        saveLocalVisitors(getLocalVisitors().filter(v => v.id !== item.id));
      }
    } catch {
      remaining.push(item);
      // Preserve ordering and retry the rest on the next connectivity event.
      remaining.push(...queue.slice(queue.indexOf(item) + 1));
      break;
    }
  }
  write(QUEUE_KEY, remaining);
}

export async function fetchVisitorsOfflineSafe(search?: string): Promise<Visitor[]> {
  try {
    // Flush queued changes first so a fresh server response cannot overwrite
    // unsynced local records.
    await syncOfflineData();
    const visitors = await listVisitors(search ? { search } : undefined);
    const queue = getQueue();
    const local = getLocalVisitors();
    const pendingCreates = new Set(queue.filter(item => item.type === 'create').map(item => item.localId));
    const pendingDeletes = new Set(queue.filter(item => item.type === 'delete').map(item => item.id));
    const merged = [
      ...local.filter(v => pendingCreates.has(v.id)),
      ...visitors.filter(v => !pendingDeletes.has(v.id)),
    ];
    const unique = Array.from(new Map(merged.map(v => [v.id, v])).values())
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
    if (!queue.length) saveLocalVisitors(visitors);
    const term = search?.trim().toLowerCase();
    return term
      ? unique.filter(v => [v.name, v.phone, v.personToMeet, v.purpose].some(x => x.toLowerCase().includes(term)))
      : unique;
  } catch {
    const local = getLocalVisitors();
    const term = search?.trim().toLowerCase();
    return term ? local.filter(v => [v.name, v.phone, v.personToMeet, v.purpose].some(x => x.toLowerCase().includes(term))) : local;
  }
}
