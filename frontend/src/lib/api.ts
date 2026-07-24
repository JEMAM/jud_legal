export const getApiUrl = (endpoint: string = "") => {
  const cleanEndpoint = endpoint ? (endpoint.startsWith("/") ? endpoint : `/${endpoint}`) : "";

  // Se o endpoint for a busca PJe, redireciona para a rota nativa da Vercel (IP em SP Brasil) em produção
  if (cleanEndpoint === "/api/search-pje") {
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\./.test(host)) {
        return `http://${host}:8000/api/search-pje`;
      }
    }
    return "/api/search-pje";
  }

  let baseUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!baseUrl) {
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\./.test(host)) {
        baseUrl = `http://${host}:8000`;
      } else {
        baseUrl = "https://jud-legal.onrender.com";
      }
    } else {
      baseUrl = "https://jud-legal.onrender.com";
    }
  }

  if (!endpoint) return baseUrl;
  return `${baseUrl}${cleanEndpoint}`;
};
