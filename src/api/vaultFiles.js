// Vault Files API abstraction
// Relies on central apiClient. Endpoint path suffix can be changed here without touching components.

import { apiClient, fileToBase64 } from './client';

const VAULT_PATH = '/delphi-vault-file';

export async function listVaultFiles() {
  const data = await apiClient.request('GET', VAULT_PATH);
  return (data.files || []).map(f => ({
    key: f.key,
    size: f.size,
    uploadedAt: f.last_modified ? new Date(f.last_modified).getTime() : Date.now(),
    status: 'ready',
    embeddings: 0,
  }));
}

export async function uploadVaultFile(file, onProgress) {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Only PDF files are allowed');
  // Convert
  const b64 = await fileToBase64(file);
  // (Optional onProgress callbacks)
  onProgress && onProgress(40);
  const resp = await apiClient.request('POST', VAULT_PATH, { body: { fileName: file.name, fileData: b64 } });
  onProgress && onProgress(90);
  return { key: resp.key || file.name, size: file.size };
}

export async function deleteVaultFile(key) {
  return apiClient.request('DELETE', VAULT_PATH, { query: { key } });
}

// Get a presigned URL for viewing/downloading a specific file.
// Returns { url, key, expires_in }
export async function getVaultFileUrl(key) {
  if (!key) throw new Error('key required');
  const data = await apiClient.request('GET', VAULT_PATH, { query: { key } });
  if (data.url) return data;
  throw new Error('No URL returned (keys: ' + Object.keys(data || {}).join(',') + ')');
}
