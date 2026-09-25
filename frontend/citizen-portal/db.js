/**
 * db.js — IndexedDB helper for offline report queue
 * SIH26102 MPLAD Citizen Portal
 *
 * Stores reports that fail to POST (no connectivity) so they can be
 * retried once the device comes back online. Each queued entry contains
 * the full FormData payload as a plain object (binary photo stored as
 * ArrayBuffer so it survives serialization).
 */

(function(window) {
  'use strict';

  const DB_NAME = 'mplad-citizen-portal';
  const DB_VERSION = 1;
  const STORE = 'pending-reports';

  /** Opens (or creates) the IndexedDB database. Returns a Promise<IDBDatabase>. */
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  /**
   * Queues a pending report.
   * @param {Object} payload  All form fields as plain JS object.
   *   photo should be an ArrayBuffer (read from the File object before storing).
   *   photoName and photoType should be stored separately so we can reconstruct the File.
   * @returns {Promise<number>} The localId assigned to the queued record.
   */
  async function queueReport(payload) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add({ ...payload, queuedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  /** Returns all pending reports as an array (oldest first). */
  async function getAllQueued() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  /** Deletes a queued report by its localId (after successful upload). */
  async function deleteQueued(localId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(localId);
      req.onsuccess = () => resolve();
      req.onerror  = () => reject(req.error);
    });
  }

  /** Returns the count of pending reports. */
  async function pendingCount() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  if (typeof window !== 'undefined') {
    window.MPLAD_DB = {
      openDb,
      queueReport,
      getAllQueued,
      deleteQueued,
      pendingCount
    };
  }
})(typeof window !== 'undefined' ? window : this);
