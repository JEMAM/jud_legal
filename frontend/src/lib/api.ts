export const getApiUrl = (endpoint: string = "") => {
  let baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
      baseUrl = `http://${window.location.hostname}:8000`;
    } else {
      baseUrl = "http://localhost:8000";
    }
  }
  if (!endpoint) return baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

