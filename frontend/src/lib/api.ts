export const getApiUrl = (endpoint: string = "") => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  if (!endpoint) return baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};
