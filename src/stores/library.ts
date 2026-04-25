import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { LabelDocument } from '@burnmark-io/designer-core';
import {
  deleteDesign as removeFromDb,
  deleteMeta,
  getMeta,
  listDesignSummaries,
  loadDesign as loadDesignFromDb,
  saveDesign as saveToDb,
  setMeta,
  type StoredDesignSummary,
} from '@/services/storage';

export const MAX_SLOTS = 10;
const LAST_OPENED_KEY = 'lastOpenedId';

export type LibraryEntry = StoredDesignSummary;

export class LibraryFullError extends Error {
  constructor() {
    super('All slots are in use');
    this.name = 'LibraryFullError';
  }
}

/**
 * Library store — owns the in-memory mirror of saved designs in
 * IndexedDB and enforces the 10-slot ceiling. Operations are async
 * because IndexedDB is async; consumers should `await` them.
 */
export const useLibraryStore = defineStore('library', () => {
  const entries = ref<LibraryEntry[]>([]);
  const loaded = ref(false);
  const lastOpenedId = ref<string | null>(null);

  const remainingSlots = computed(() => Math.max(0, MAX_SLOTS - entries.value.length));
  const isFull = computed(() => entries.value.length >= MAX_SLOTS);

  async function load(): Promise<void> {
    if (loaded.value) return;
    entries.value = await listDesignSummaries();
    lastOpenedId.value = (await getMeta<string>(LAST_OPENED_KEY)) ?? null;
    loaded.value = true;
  }

  async function save(
    doc: LabelDocument,
    extras: { description?: string; thumbnail?: string } = {},
  ): Promise<LibraryEntry> {
    const exists = entries.value.some((e) => e.id === doc.id);
    if (!exists && entries.value.length >= MAX_SLOTS) {
      throw new LibraryFullError();
    }
    const summary = await saveToDb(doc, extras);
    entries.value = [
      summary,
      ...entries.value.filter((e) => e.id !== summary.id),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summary;
  }

  async function loadDesign(id: string): Promise<LabelDocument | null> {
    const doc = await loadDesignFromDb(id);
    if (doc) {
      lastOpenedId.value = id;
      await setMeta(LAST_OPENED_KEY, id);
    }
    return doc;
  }

  async function deleteDesign(id: string): Promise<void> {
    await removeFromDb(id);
    entries.value = entries.value.filter((e) => e.id !== id);
    if (lastOpenedId.value === id) {
      lastOpenedId.value = null;
      await deleteMeta(LAST_OPENED_KEY);
    }
  }

  async function rename(id: string, name: string, description?: string): Promise<void> {
    const doc = await loadDesignFromDb(id);
    if (!doc) return;
    doc.name = name;
    if (description !== undefined) doc.description = description;
    doc.updatedAt = new Date().toISOString();
    await saveToDb(doc, { description });
    entries.value = entries.value.map((e) =>
      e.id === id ? { ...e, name, description, updatedAt: doc.updatedAt } : e,
    );
  }

  return {
    entries,
    loaded,
    lastOpenedId,
    remainingSlots,
    isFull,
    MAX_SLOTS,
    load,
    save,
    loadDesign,
    deleteDesign,
    rename,
  };
});
