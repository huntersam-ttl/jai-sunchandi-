import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/format";

/**
 * Supabase Storage upload helpers (website).
 *
 * Buckets are created by supabase/migrations/0001_init.sql. The frontend uses the
 * anon key only (via supabaseClient); the service-role key stays backend-only.
 *
 * Public buckets return a public URL; private buckets return only the stored
 * PATH — a signed URL is resolved on demand (getSignedUrl), so private photos are
 * never exposed through a public URL. No base64 is stored: callers persist the
 * returned url/path into database-ready fields.
 */
export const STORAGE_BUCKETS = {
  product: { id: "product-photos", public: true, folder: "products" },
  shop: { id: "shop", public: true, folder: "shop" },
  repair: { id: "repair-photos", public: false, folder: "repairs" },
  lead: { id: "lead-photos", public: false, folder: "leads" },
  bill: { id: "bill-photos", public: false, folder: "bills" },
  voice: { id: "voice-notes", public: false, folder: "voices" },
};

function uniqueName(ext = "webp") {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${id}.${ext}`;
}

async function compressToBlob(file, maxDim = 1200, quality = 0.8) {
  const dataUrl = await compressImage(file, maxDim, quality);
  const res = await fetch(dataUrl);
  return res.blob();
}

function resolveBucket(bucketKey) {
  const bucket = STORAGE_BUCKETS[bucketKey];
  if (!bucket) throw new Error(`Unknown storage bucket: ${bucketKey}`);
  return bucket;
}

/**
 * Compress and upload an image to a bucket.
 * @returns {Promise<{bucket:string, path:string, publicUrl:string|null, isPublic:boolean}>}
 * For private buckets publicUrl is null — store `path` and resolve a signed URL at display time.
 */
export async function uploadImage(file, bucketKey, { folder, maxDim = 1200, quality = 0.8 } = {}) {
  if (!supabase) throw new Error("Supabase is not configured");
  const bucket = resolveBucket(bucketKey);

  const blob = await compressToBlob(file, maxDim, quality);
  const isWebp = blob.type === "image/webp";
  const path = `${folder || bucket.folder}/${uniqueName(isWebp ? "webp" : "jpg")}`;

  const { data, error } = await supabase.storage
    .from(bucket.id)
    .upload(path, blob, { contentType: isWebp ? "image/webp" : "image/jpeg", upsert: false });
  if (error) throw error;

  if (bucket.public) {
    const { data: pub } = supabase.storage.from(bucket.id).getPublicUrl(data.path);
    return { bucket: bucket.id, path: data.path, publicUrl: pub.publicUrl, isPublic: true };
  }
  return { bucket: bucket.id, path: data.path, publicUrl: null, isPublic: false };
}

/** Public URL for an object in a public bucket. */
export function getPublicUrl(bucketKey, path) {
  const bucket = STORAGE_BUCKETS[bucketKey];
  if (!supabase || !bucket || !path) return null;
  return supabase.storage.from(bucket.id).getPublicUrl(path).data.publicUrl;
}

/** Time-limited signed URL for an object in a PRIVATE bucket (admin/authenticated). */
export async function getSignedUrl(bucketKey, path, expiresIn = 3600) {
  if (!supabase) throw new Error("Supabase is not configured");
  const bucket = resolveBucket(bucketKey);
  const { data, error } = await supabase.storage
    .from(bucket.id)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Delete an object (admin/authenticated). */
export async function removeImage(bucketKey, path) {
  if (!supabase) throw new Error("Supabase is not configured");
  const bucket = resolveBucket(bucketKey);
  const { error } = await supabase.storage.from(bucket.id).remove([path]);
  if (error) throw error;
}

export async function uploadVoiceNote(file) {
  if (!supabase) throw new Error("Supabase is not configured");
  const formats = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/ogg": "ogg" };
  const type = String(file?.type || "").split(";")[0];
  if (!formats[type]) throw new Error("Unsupported audio. Use WebM, M4A, MP3, or OGG.");
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("Voice note must be under 2 MB.");
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") throw new Error("Secure upload unavailable. Please use a current browser.");
  const path = `voices/${crypto.randomUUID()}.${formats[type]}`;
  const { data, error } = await supabase.storage.from("voice-notes")
    .upload(path, file, { contentType: type, upsert: false });
  if (error) throw error;
  return data.path;
}
