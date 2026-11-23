export interface RecentDoc {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  viewedAt: number;
}

const CACHE_NAME = 'kurickal-doc-viewer-v1';
const RECENT_DOCS_KEY = 'kurickal_recent_docs';
const MAX_RECENT_DOCS = 10;

/**
 * Fetch a document file using Cache Storage.
 * Resolves with the Blob of the document.
 */
export const getCachedDocument = async (url: string): Promise<Blob> => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      return await cachedResponse.blob();
    }

    // Not in cache, fetch and store
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    // Cache the response clone
    await cache.put(url, response.clone());
    return await response.blob();
  } catch (err) {
    console.error('Error fetching/caching file, falling back to direct network fetch:', err);
    // Fallback: direct fetch without caching
    const response = await fetch(url);
    return await response.blob();
  }
};

/**
 * Add a document to the recent list in localStorage
 */
export const addRecentDocument = (doc: { id: string; name: string; url: string; mimeType: string; size: number }) => {
  try {
    const recentStr = localStorage.getItem(RECENT_DOCS_KEY);
    let recent: RecentDoc[] = recentStr ? JSON.parse(recentStr) : [];

    // Filter out if already exists
    recent = recent.filter((d) => d.url !== doc.url);

    // Prepend new document
    recent.unshift({
      ...doc,
      viewedAt: Date.now(),
    });

    // Cap at MAX_RECENT_DOCS
    if (recent.length > MAX_RECENT_DOCS) {
      recent = recent.slice(0, MAX_RECENT_DOCS);
    }

    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recent));
  } catch (e) {
    console.error('Failed to save recent document:', e);
  }
};

/**
 * Get the list of recent documents
 */
export const getRecentDocuments = (): RecentDoc[] => {
  try {
    const recentStr = localStorage.getItem(RECENT_DOCS_KEY);
    return recentStr ? JSON.parse(recentStr) : [];
  } catch (e) {
    console.error('Failed to read recent documents:', e);
    return [];
  }
};

/**
 * Clear cache (e.g. on logout or manual cache refresh)
 */
export const clearDocumentCache = async (): Promise<boolean> => {
  try {
    return await caches.delete(CACHE_NAME);
  } catch (e) {
    console.error('Failed to clear cache:', e);
    return false;
  }
};
