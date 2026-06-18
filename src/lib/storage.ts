import { getSupabase, STORAGE_BUCKETS, isStorageConfigured } from './supabase';

export { STORAGE_BUCKETS, isStorageConfigured };

/** Result of a successful upload. */
export interface UploadResult {
  /** Public URL for displaying / downloading the file. */
  url: string;
  /** Storage path within the bucket (persist this to delete later). */
  path: string;
  bucket: string;
}

// Strip characters that are awkward in storage keys while keeping the extension.
function sanitizeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot) : '';
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .slice(0, 80) || 'file';
  return `${base}${ext.toLowerCase()}`;
}

/**
 * Upload a file to a Supabase Storage bucket and return its public URL.
 *
 * @param file    the File/Blob to upload
 * @param bucket  one of STORAGE_BUCKETS
 * @param folder  optional sub-folder/prefix (e.g. a projectId or channelId)
 */
export async function uploadToSupabase(
  file: File,
  bucket: string,
  folder?: string,
): Promise<UploadResult> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      'File storage is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
  const path = `${prefix}${Date.now()}_${sanitizeName(file.name)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, bucket };
}

/** Delete a previously-uploaded file by bucket + path (best-effort). */
export async function deleteFromSupabase(bucket: string, path: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !path) return;
  await supabase.storage.from(bucket).remove([path]);
}
