import { getCurrentUserId } from "./api";

export const LOCAL_WRITING_TASKS_KEY = "smartenglish.writing.local_tasks";

export type LocalWritingTask = {
  id: string;
  title: string;
  prompt: string;
  task_type?: string;
  level?: string;
  word_limit?: number;
  time_limit_minutes?: number;
  generated?: boolean;
  source?: string;
  created_at?: string;
};

export function readLocalWritingTasks(): LocalWritingTask[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${LOCAL_WRITING_TASKS_KEY}.${getCurrentUserId()}`) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item => item?.id && item?.title && item?.prompt) : [];
  } catch {
    return [];
  }
}

export function saveLocalWritingTasks(items: LocalWritingTask[]) {
  localStorage.setItem(`${LOCAL_WRITING_TASKS_KEY}.${getCurrentUserId()}`, JSON.stringify(items.slice(0, 80)));
}

export function addLocalWritingTasks(items: LocalWritingTask[]) {
  const existing = readLocalWritingTasks();
  const merged = [
    ...items,
    ...existing.filter(item => !items.some(next => next.id === item.id)),
  ];
  saveLocalWritingTasks(merged);
  return merged;
}
