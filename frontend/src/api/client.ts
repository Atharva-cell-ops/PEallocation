import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
