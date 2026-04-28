import createClient from 'openapi-fetch';
import type { paths } from './api.types';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = createClient<paths>({
  baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { baseUrl };
