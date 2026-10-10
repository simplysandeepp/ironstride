/**
 * Remembers the chosen backup folder between visits. A folder handle cannot go into the main
 * database export, so it lives in its own tiny database that restore and reset never touch.
 */
const DB_NAME = 'ironstride-backup-meta'
const STORE = 'kv'
const KEY = 'backup-folder'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export const saveFolderHandle = (handle: unknown) =>
  run('readwrite', (s) => s.put(handle, KEY)).then(() => undefined)
export const loadFolderHandle = async <T>(): Promise<T | undefined> =>
  (await run('readonly', (s) => s.get(KEY))) as T | undefined
export const clearFolderHandle = () => run('readwrite', (s) => s.delete(KEY)).then(() => undefined)
