import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function createTable(token, projectId, csrfToken) {
  const tableName = `load_table_${__VU}_${Date.now()}`.replace(/\./g, '_');
  const res = http.post(`${BASE_URL}/database/${projectId}/tables`, JSON.stringify({
    tableName,
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()', isRequired: true },
      { name: 'name', type: 'text', isRequired: true },
      { name: 'value', type: 'integer', defaultValue: '0', isRequired: false },
      { name: 'created_at', type: 'timestamptz', defaultValue: 'now()', isRequired: false },
    ],
  }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'create table 201': (r) => r.status === 201 });
  return tableName;
}

export function executeQuery(token, projectId, query) {
  const res = http.post(`${BASE_URL}/database/${projectId}/query`, JSON.stringify({ query }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  check(res, { 'query 200': (r) => r.status === 200 });
}

export function insertRow(token, projectId, tableName, csrfToken) {
  const res = http.post(`${BASE_URL}/database/${projectId}/tables/${tableName}/rows`, JSON.stringify({
    name: `row_${__VU}_${Date.now()}`,
    value: Math.floor(Math.random() * 1000),
  }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'insert row 201': (r) => r.status === 201 || r.status === 200 });
}

export function queryRows(token, projectId, tableName) {
  const res = http.get(`${BASE_URL}/database/${projectId}/tables/${tableName}/rows?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'query rows 200': (r) => r.status === 200 });
}

export function listTables(token, projectId) {
  const res = http.get(`${BASE_URL}/database/${projectId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'list tables 200': (r) => r.status === 200 });
}
