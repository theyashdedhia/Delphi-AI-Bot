// Vault Files API abstraction
// Relies on central apiClient. Endpoint path suffix can be changed here without touching components.

import { apiClient, fileToBase64 } from './client';

const VAULT_PATH = '/delphi-vault-file';
const CHUNKS_PATH = '/delphi-vault-chunks';

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
  console.log('uploadVaultFile: resp', resp);
  return { 
    key: resp.key || file.name, 
    size: file.size,
    job_id: resp.job_id
  };
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

// Get job status for async processing
// Returns { success, job_id, key, state, chunk_count, last_updated }
export async function getJobStatus(jobId) {
  if (!jobId) throw new Error('job_id required');
  const data = await apiClient.request('GET', VAULT_PATH, { query: { job_id: jobId } });
  console.log('getJobStatus: data', data);
  return data;
}

// Get chunks for a file
// Returns { success, chunks, count, file_key }
export async function getVaultFileChunks(fileName) {
  if (!fileName) throw new Error('fileName required');
  const data = await apiClient.request('GET', CHUNKS_PATH, { query: { file_name: fileName } });
  return data;
}

// Update a chunk
// Returns { success, message, chunk }
export async function updateVaultChunk(chunkData) {
  if (!chunkData.chunk_id || !chunkData.file_key) {
    throw new Error('chunk_id and file_key are required');
  }
  const data = await apiClient.request('PUT', CHUNKS_PATH, { body: chunkData });
  return data;
}
