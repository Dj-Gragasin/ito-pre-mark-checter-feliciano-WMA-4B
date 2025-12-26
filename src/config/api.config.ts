/**
 * API Configuration
 * Central location for API endpoint configuration
 * Uses environment variable if available, falls back to sensible default
 */

export const API_CONFIG = {
  // Base URL for backend API calls
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3002/api',
};

export default API_CONFIG;
