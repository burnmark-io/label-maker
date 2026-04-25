import { defineStore } from 'pinia';
import { computed, ref, toRaw, watch } from 'vue';
import {
  applyMappingToRow,
  autoMapColumns,
  loadMapping,
  saveMapping,
  templateKeyFromPlaceholders,
} from '@/services/column-mapper';
import {
  clearDatasets as idbClearDatasets,
  deleteDataset as idbDeleteDataset,
  listDatasets as idbListDatasets,
  putDataset as idbPutDataset,
  type DatasetSource,
  type StoredDataset,
} from '@/services/storage';
import { useDesignerStore } from './designer';
import { usePreferencesStore } from './preferences';

const HAS_IDB = typeof indexedDB !== 'undefined';

/**
 * Maximum rows the app will keep in any single dataset. Anything beyond
 * this is silently truncated — the UI surfaces a banner ("showing first
 * 30 rows"). Friendly cap, no paid-tier framing.
 */
export const ROW_LIMIT = 30;

/** Maximum datasets in the global pool. New imports past this evict the LRU. */
export const DATASET_LIMIT = 10;

export type ImportSource = Exclude<DatasetSource, 'manual'>;

export interface ImportSummary {
  source: ImportSource;
  fileName: string;
  totalRowsInFile: number;
}

const PERSIST_DEBOUNCE_MS = 300;

function nowIso(): string {
  return new Date().toISOString();
}

function newDatasetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ds_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function defaultDatasetName(seed: { source: DatasetSource; fileName: string | null }): string {
  if (seed.source === 'manual') return 'Manual entry';
  return seed.fileName ?? 'Imported data';
}

/**
 * Snapshot a reactive dataset into a plain object that can cross the
 * IDB structured-clone boundary. Vue's reactive proxies can't be cloned
 * directly — we need raw arrays and plain object cells.
 */
function snapshot(ds: StoredDataset): StoredDataset {
  const raw = toRaw(ds);
  return {
    ...raw,
    headers: [...toRaw(raw.headers)],
    rows: toRaw(raw.rows).map(r => ({ ...toRaw(r) })),
  };
}

/**
 * Global data store — owns the dataset pool (≤10 sets, ≤30 rows each),
 * the active-set pointer, the previewed-row index, and the live mapping
 * for the current design's placeholder set.
 *
 * Datasets are global to the browser, not bound to any particular
 * `LabelDocument`. Mapping is read straight from the placeholder-set-
 * keyed cache in `services/column-mapper.ts` (D21) — same dataset maps
 * cleanly into multiple designs without duplicate state.
 */
export const useDataStore = defineStore('data', () => {
  const designer = useDesignerStore();
  const prefs = usePreferencesStore();

  const datasets = ref<StoredDataset[]>([]);
  const currentIndex = ref(0);
  const previewEnabled = ref(true);
  /** Bumped on mapping mutations so `currentVariables` recomputes. */
  const mappingVersion = ref(0);

  const placeholders = computed<string[]>(() => designer.getPlaceholders());

  const activeDataset = computed<StoredDataset | null>(() => {
    const id = prefs.activeDatasetId;
    if (!id) return null;
    return datasets.value.find(d => d.id === id) ?? null;
  });

  const headers = computed<string[]>(() => activeDataset.value?.headers ?? []);
  const rows = computed<Record<string, string>[]>(() => activeDataset.value?.rows ?? []);
  const lastImport = computed<ImportSummary | null>(() => {
    const ds = activeDataset.value;
    if (!ds || ds.source === 'manual') return null;
    return {
      source: ds.source,
      fileName: ds.fileName ?? '',
      totalRowsInFile: ds.totalRowsInFile,
    };
  });

  const limited = computed(() =>
    activeDataset.value
      ? activeDataset.value.totalRowsInFile > activeDataset.value.rows.length
      : false,
  );

  const hasData = computed(() => rows.value.length > 0);

  /**
   * Mapping for the current design's placeholders against the active
   * dataset's headers. Read-through from D21's placeholder-set-keyed
   * cache, with auto-map as the fill-in for unmapped placeholders.
   * Recomputes when placeholders, headers, or the cache change
   * (`mappingVersion` bumps on every mutation).
   */
  const mapping = computed<Record<string, string>>(() => {
    void mappingVersion.value;
    const phs = placeholders.value;
    const hs = headers.value;
    if (phs.length === 0 || hs.length === 0) return {};
    const key = templateKeyFromPlaceholders(phs);
    const remembered = key ? loadMapping(key) : null;
    if (remembered && Object.keys(remembered).length > 0) {
      const filtered: Record<string, string> = {};
      for (const [ph, col] of Object.entries(remembered)) {
        if (hs.includes(col)) filtered[ph] = col;
      }
      const auto = autoMapColumns(hs, phs);
      return { ...auto.mapping, ...filtered };
    }
    return autoMapColumns(hs, phs).mapping;
  });

  const currentVariables = computed<Record<string, string>>(() => {
    if (!previewEnabled.value || rows.value.length === 0) return {};
    const idx = Math.min(currentIndex.value, rows.value.length - 1);
    const row = rows.value[idx];
    if (!row) return {};
    if (Object.keys(mapping.value).length === 0) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = String(v ?? '');
      return out;
    }
    return applyMappingToRow(row, mapping.value);
  });

  function bumpMapping(): void {
    mappingVersion.value += 1;
  }

  function setColumnFor(placeholder: string, column: string | null): void {
    const phs = placeholders.value;
    const key = templateKeyFromPlaceholders(phs);
    if (!key) return;
    const next = { ...(loadMapping(key) ?? mapping.value) };
    const phKey = placeholder.toLowerCase();
    if (column === null || column === '') {
      delete next[phKey];
    } else {
      next[phKey] = column;
    }
    saveMapping(key, next);
    bumpMapping();
  }

  function setMapping(next: Record<string, string>): void {
    const key = templateKeyFromPlaceholders(placeholders.value);
    if (!key) return;
    saveMapping(key, { ...next });
    bumpMapping();
  }

  function step(delta: number): void {
    if (rows.value.length === 0) return;
    const next = (currentIndex.value + delta + rows.value.length) % rows.value.length;
    currentIndex.value = next;
  }

  function setIndex(idx: number): void {
    if (rows.value.length === 0) return;
    currentIndex.value = Math.max(0, Math.min(idx, rows.value.length - 1));
  }

  function togglePreview(): void {
    previewEnabled.value = !previewEnabled.value;
  }

  // ---- Dataset pool mutators -----------------------------------------

  /** Touch a dataset's `updatedAt` and re-sort the pool by recency. */
  function touch(ds: StoredDataset): void {
    ds.updatedAt = nowIso();
    datasets.value = [...datasets.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function pickEvictionVictim(): StoredDataset | null {
    // The pool is maintained in most-recent-first order (createDataset
    // prepends, touch() re-sorts), so the least-recently-updated set
    // sits at the tail. Walk from the end and skip the active set so
    // the user never loses the data they're currently working with.
    for (let i = datasets.value.length - 1; i >= 0; i -= 1) {
      const ds = datasets.value[i];
      if (ds.id !== prefs.activeDatasetId) return ds;
    }
    return null;
  }

  /**
   * Create a dataset and put it in the pool. Returns the new dataset.
   * If the pool is at the cap, evicts the least-recently-updated
   * non-active set silently when it's an importable set, or invokes
   * `onEvictManual` for hand-typed work that the caller may want to
   * confirm before discarding.
   */
  function createDataset(
    seed: {
      source: DatasetSource;
      fileName?: string | null;
      headers: string[];
      rows?: Record<string, string>[];
      totalRowsInFile?: number;
      name?: string;
    },
    options: { onEvictManual?: (victim: StoredDataset) => boolean } = {},
  ): StoredDataset | null {
    if (datasets.value.length >= DATASET_LIMIT) {
      const victim = pickEvictionVictim();
      if (!victim) return null;
      if (victim.source === 'manual' && options.onEvictManual) {
        const proceed = options.onEvictManual(victim);
        if (!proceed) return null;
      }
      removeDataset(victim.id);
    }

    const ds: StoredDataset = {
      id: newDatasetId(),
      name:
        seed.name ?? defaultDatasetName({ source: seed.source, fileName: seed.fileName ?? null }),
      source: seed.source,
      fileName: seed.fileName ?? null,
      headers: [...seed.headers],
      rows: (seed.rows ?? []).slice(0, ROW_LIMIT).map(row => ({ ...row })),
      totalRowsInFile: seed.totalRowsInFile ?? seed.rows?.length ?? 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    datasets.value = [ds, ...datasets.value];
    schedulePersist(ds.id);
    return ds;
  }

  function setActiveDataset(id: string | null): void {
    if (id && !datasets.value.some(d => d.id === id)) return;
    prefs.activeDatasetId = id;
    currentIndex.value = 0;
  }

  function renameDataset(id: string, name: string): void {
    const ds = datasets.value.find(d => d.id === id);
    if (!ds) return;
    ds.name = name.trim() || defaultDatasetName(ds);
    touch(ds);
    schedulePersist(ds.id);
  }

  function duplicateDataset(
    id: string,
    options: { onEvictManual?: (victim: StoredDataset) => boolean } = {},
  ): StoredDataset | null {
    const source = datasets.value.find(d => d.id === id);
    if (!source) return null;
    return createDataset(
      {
        source: source.source,
        fileName: source.fileName,
        headers: [...source.headers],
        rows: source.rows.map(r => ({ ...r })),
        totalRowsInFile: source.totalRowsInFile,
        name: `${source.name} (copy)`,
      },
      options,
    );
  }

  function removeDataset(id: string): void {
    const idx = datasets.value.findIndex(d => d.id === id);
    if (idx < 0) return;
    datasets.value = datasets.value.filter(d => d.id !== id);
    if (prefs.activeDatasetId === id) {
      const fallback = datasets.value[0]?.id ?? null;
      prefs.activeDatasetId = fallback;
      currentIndex.value = 0;
    }
    if (HAS_IDB) void idbDeleteDataset(id);
  }

  /**
   * Append rows (and any new headers) to the active dataset. Missing
   * columns become empty strings. Caps at ROW_LIMIT; updates
   * `totalRowsInFile` to reflect the *attempted* total so the limit
   * banner stays accurate after appends.
   */
  function appendRowsToActive(
    incomingHeaders: string[],
    incomingRows: Record<string, string>[],
    summary?: { source?: ImportSource; fileName?: string; totalRowsInFile?: number },
  ): void {
    const ds = activeDataset.value;
    if (!ds) return;
    const mergedHeaders = [...ds.headers];
    for (const h of incomingHeaders) {
      if (!mergedHeaders.includes(h)) mergedHeaders.push(h);
    }
    const padded = incomingRows.map(row => {
      const out: Record<string, string> = {};
      for (const h of mergedHeaders) out[h] = row[h] ?? '';
      return out;
    });
    const oldRowsPadded = ds.rows.map(row => {
      const out: Record<string, string> = {};
      for (const h of mergedHeaders) out[h] = row[h] ?? '';
      return out;
    });
    const combined = [...oldRowsPadded, ...padded].slice(0, ROW_LIMIT);
    ds.headers = mergedHeaders;
    ds.rows = combined;
    if (summary) {
      ds.totalRowsInFile =
        (ds.totalRowsInFile || ds.rows.length) + (summary.totalRowsInFile ?? incomingRows.length);
      if (summary.fileName && ds.source !== 'manual') ds.fileName = summary.fileName;
    } else {
      ds.totalRowsInFile = combined.length;
    }
    touch(ds);
    schedulePersist(ds.id);
    currentIndex.value = 0;
  }

  /** Add an empty row to the active dataset (capped at ROW_LIMIT). */
  function addRowToActive(): void {
    const ds = activeDataset.value;
    if (!ds || ds.rows.length >= ROW_LIMIT) return;
    const empty: Record<string, string> = {};
    for (const h of ds.headers) empty[h] = '';
    ds.rows = [...ds.rows, empty];
    ds.totalRowsInFile = ds.rows.length;
    touch(ds);
    schedulePersist(ds.id);
    currentIndex.value = ds.rows.length - 1;
  }

  function updateActiveRow(rowIndex: number, header: string, value: string): void {
    const ds = activeDataset.value;
    if (!ds) return;
    const row = ds.rows[rowIndex];
    if (!row) return;
    if (!ds.headers.includes(header)) return;
    row[header] = value;
    touch(ds);
    schedulePersist(ds.id);
  }

  function deleteActiveRow(rowIndex: number): void {
    const ds = activeDataset.value;
    if (!ds) return;
    if (rowIndex < 0 || rowIndex >= ds.rows.length) return;
    ds.rows = ds.rows.filter((_, i) => i !== rowIndex);
    ds.totalRowsInFile = ds.rows.length;
    touch(ds);
    schedulePersist(ds.id);
    if (currentIndex.value >= ds.rows.length) {
      currentIndex.value = Math.max(0, ds.rows.length - 1);
    }
  }

  function duplicateActiveRow(rowIndex: number): void {
    const ds = activeDataset.value;
    if (!ds || ds.rows.length >= ROW_LIMIT) return;
    const src = ds.rows[rowIndex];
    if (!src) return;
    const copy = { ...src };
    ds.rows = [...ds.rows.slice(0, rowIndex + 1), copy, ...ds.rows.slice(rowIndex + 1)];
    ds.totalRowsInFile = ds.rows.length;
    touch(ds);
    schedulePersist(ds.id);
  }

  function moveActiveRow(rowIndex: number, delta: -1 | 1): void {
    const ds = activeDataset.value;
    if (!ds) return;
    const target = rowIndex + delta;
    if (target < 0 || target >= ds.rows.length) return;
    const next = [...ds.rows];
    [next[rowIndex], next[target]] = [next[target], next[rowIndex]];
    ds.rows = next;
    touch(ds);
    schedulePersist(ds.id);
  }

  function addColumnToActive(name?: string): string | null {
    const ds = activeDataset.value;
    if (!ds) return null;
    let header = (name ?? '').trim();
    if (!header) {
      let n = ds.headers.length + 1;
      while (ds.headers.includes(`column_${n}`)) n += 1;
      header = `column_${n}`;
    }
    if (ds.headers.includes(header)) return null;
    ds.headers = [...ds.headers, header];
    for (const row of ds.rows) row[header] = '';
    touch(ds);
    schedulePersist(ds.id);
    return header;
  }

  /** Empty the active dataset's rows (keeps headers, keeps the dataset). */
  function clearActive(): void {
    const ds = activeDataset.value;
    if (!ds) return;
    ds.rows = [];
    ds.totalRowsInFile = 0;
    touch(ds);
    schedulePersist(ds.id);
    currentIndex.value = 0;
  }

  /** Wipe every dataset and reset the active pointer. */
  function resetAll(): void {
    datasets.value = [];
    prefs.activeDatasetId = null;
    currentIndex.value = 0;
    if (HAS_IDB) void idbClearDatasets();
  }

  // ---- Backwards-compat shims ---------------------------------------

  /**
   * Legacy entry point used by the CSV import composable and tests.
   * Replaces the active dataset's contents with the imported set.
   * Phase D wires the import dialog (append / new / cancel) and most
   * call-sites should switch to `createDataset` / `appendRowsToActive`
   * directly; this remains the single-step "make it the active set"
   * shortcut.
   */
  function setData(
    nextHeaders: string[],
    nextRows: Record<string, string>[],
    summary: ImportSummary,
  ): void {
    const trimmed = nextRows.slice(0, ROW_LIMIT);
    const created = createDataset({
      source: summary.source,
      fileName: summary.fileName,
      headers: nextHeaders,
      rows: trimmed,
      totalRowsInFile: summary.totalRowsInFile,
      name: summary.fileName,
    });
    if (created) setActiveDataset(created.id);
  }

  /**
   * Legacy entry point. Removes the active dataset (with its data) — the
   * old "Clear data" button mapped to "discard the imported set", and
   * the closest analogue in the global model is delete-active.
   */
  function clear(): void {
    const id = prefs.activeDatasetId;
    if (id) removeDataset(id);
  }

  // ---- Persistence ---------------------------------------------------

  let bootHydrated = false;
  let hydrating: Promise<void> | null = null;

  async function hydrate(): Promise<void> {
    if (bootHydrated) return;
    if (hydrating) return hydrating;
    if (!HAS_IDB) {
      bootHydrated = true;
      return;
    }
    hydrating = (async () => {
      try {
        const all = await idbListDatasets();
        datasets.value = all;
        const activeId = prefs.activeDatasetId;
        if (activeId && !all.some(d => d.id === activeId)) {
          // Stale pointer (manually edited storage / data corruption /
          // foreign-tab deletion). Fall back to the most recent set,
          // else null. Logged for observability without throwing.
          console.warn(
            `[burnmark] activeDatasetId "${activeId}" no longer resolves; falling back to most-recent set.`,
          );
          prefs.activeDatasetId = all[0]?.id ?? null;
        }
        bootHydrated = true;
      } finally {
        hydrating = null;
      }
    })();
    return hydrating;
  }

  // No auto-hydrate at factory init — that races with synchronous
  // mutations a caller may make in the same tick. The app boot
  // (`main.ts`) awaits `useDataStore().hydrate()` once before the UI
  // mounts; tests do the same under fake-indexeddb.

  // Persist mutations. Each mutator that touches a dataset's contents
  // calls `schedulePersist(id)`; a single debounced timer flushes all
  // dirty ids through `idbPutDataset` in one go. Deletions go straight
  // to `idbDeleteDataset` / `idbClearDatasets` — they don't queue
  // through this path.
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const dirty = new Set<string>();

  function schedulePersist(id: string): void {
    if (!HAS_IDB) return;
    dirty.add(id);
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      const ids = [...dirty];
      dirty.clear();
      for (const dirtyId of ids) {
        const ds = datasets.value.find(d => d.id === dirtyId);
        if (ds) void idbPutDataset(snapshot(ds));
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  async function flushPersist(): Promise<void> {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const ids = [...dirty];
    dirty.clear();
    if (!HAS_IDB) return;
    await Promise.all(
      ids.map(id => {
        const ds = datasets.value.find(d => d.id === id);
        return ds ? idbPutDataset(snapshot(ds)) : Promise.resolve();
      }),
    );
  }

  // When placeholders change (user edits the design), the read-through
  // mapping computed picks up the new auto-map automatically — but the
  // cache might already hold a mapping from a prior session. Bump the
  // version so consumers see the latest.
  watch(placeholders, () => bumpMapping());

  return {
    // New API
    datasets,
    activeDataset,
    DATASET_LIMIT,
    createDataset,
    setActiveDataset,
    renameDataset,
    duplicateDataset,
    removeDataset,
    appendRowsToActive,
    addRowToActive,
    updateActiveRow,
    deleteActiveRow,
    duplicateActiveRow,
    moveActiveRow,
    addColumnToActive,
    clearActive,
    resetAll,
    hydrate,
    flushPersist,

    // Legacy / shared API
    headers,
    rows,
    mapping,
    lastImport,
    currentIndex,
    previewEnabled,
    placeholders,
    limited,
    hasData,
    currentVariables,
    ROW_LIMIT,
    clear,
    setData,
    setMapping,
    setColumnFor,
    step,
    setIndex,
    togglePreview,
  };
});
