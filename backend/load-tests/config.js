export const BASE_URL = __ENV.API_BASE || 'http://localhost:4000/api';

export const OPTIONS = {
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
  },
  noConnectionReuse: false,
  discardResponseBodies: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};
