/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Offline Storage (IndexedDB)
 * Team Neural Nova (SIH26102)
 *
 * Provides resilient offline storage for:
 * 1. Assigned projects worklist
 * 2. On-site DISHA checklist progress
 * 3. Offline field captures & pending feedback submissions
 * ============================================================================
 */

const DB_NAME = 'mplads_officer_db';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'work_id' });
        }
        if (!db.objectStoreNames.contains('checklists')) {
          db.createObjectStore('checklists', { keyPath: 'work_id' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export const OfficerDB = {
  /**
   * Caches projects in local IndexedDB.
   * @param {Array<Object>} projects
   */
  async cacheProjects(projects) {
    if (!Array.isArray(projects)) return;
    const db = await getDB();
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    for (const p of projects) {
      if (p && p.work_id) {
        store.put(p);
      }
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Retrieves all cached projects.
   * @returns {Promise<Array<Object>>}
   */
  async getCachedProjects() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Saves checklist progress for a specific project.
   * @param {string} workId
   * @param {Object} checklistState
   */
  async saveChecklist(workId, checklistState) {
    const db = await getDB();
    const tx = db.transaction('checklists', 'readwrite');
    const store = tx.objectStore('checklists');
    store.put({ work_id: workId, ...checklistState, updated_at: new Date().toISOString() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Loads saved checklist progress for a specific project.
   * @param {string} workId
   * @returns {Promise<Object|null>}
   */
  async getChecklist(workId) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checklists', 'readonly');
      const store = tx.objectStore('checklists');
      const req = store.get(workId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Queues an offline operation (feedback or field capture).
   * @param {string} type - 'feedback' | 'evidence'
   * @param {Object} payload
   */
  async queueAction(type, payload) {
    const db = await getDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.add({
      type,
      payload,
      created_at: new Date().toISOString(),
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Retrieves pending sync queue items.
   * @returns {Promise<Array<Object>>}
   */
  async getSyncQueue() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Clears a synced item from queue.
   * @param {number} id
   */
  async removeSyncItem(id) {
    const db = await getDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
