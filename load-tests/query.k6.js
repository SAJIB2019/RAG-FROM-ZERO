import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady_query_load: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS ?? 10),
      duration: __ENV.DURATION ?? '1m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
  },
};

const baseUrl = __ENV.BASE_URL ?? 'http://localhost:3000';
const apiKey = __ENV.API_KEY;

export default function () {
  const response = http.post(
    `${baseUrl}/api/query`,
    JSON.stringify({
      question: 'What is the refund policy?',
    }),
    {
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
    },
  );

  check(response, {
    'status is 201 or 200': (res) => res.status === 201 || res.status === 200,
  });

  sleep(1);
}
