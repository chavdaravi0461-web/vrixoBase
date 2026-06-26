import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function createBucket(token, projectId, csrfToken) {
  const name = `load-bucket-${__VU}_${Date.now()}`;
  const res = http.post(`${BASE_URL}/storage/${projectId}/buckets`, JSON.stringify({ name, isPublic: false }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'create bucket 201': (r) => r.status === 201 });
  if (res.status === 201) return res.json().id || res.json().data?.id;
  return null;
}

export function uploadFile(token, bucketId, size = 1024, csrfToken) {
  const filename = `load_file_${__VU}_${Date.now()}.txt`;
  const data = `${'x'.repeat(size)}`;
  const res = http.post(`${BASE_URL}/storage/buckets/${bucketId}/files`, {
    file: http.file(data, filename, 'text/plain'),
  }, {
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'upload file 201': (r) => r.status === 201 });
  if (res.status === 201) {
    const body = res.json();
    return body.id || body.data?.id || null;
  }
  return null;
}

export function listFiles(token, bucketId) {
  const res = http.get(`${BASE_URL}/storage/buckets/${bucketId}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'list files 200': (r) => r.status === 200 });
}

export function downloadFile(token, bucketId, fileId) {
  const res = http.get(`${BASE_URL}/storage/buckets/${bucketId}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'download file 200': (r) => r.status === 200 });
}

export function getSignedUrl(token, bucketId, fileId) {
  const res = http.get(`${BASE_URL}/storage/buckets/${bucketId}/files/${fileId}/signed-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'signed url 200': (r) => r.status === 200 });
}
