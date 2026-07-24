export const getApiUrl = (endpoint: string = "") => {
  let baseUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!baseUrl) {
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
      const host = window.location.hostname;
      // Se estiver rodando localmente no PC ou em IP da rede Wi-Fi local (ex: 192.168.x.x)
      if (host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\./.test(host)) {
        baseUrl = `http://${host}:8000`;
      } else {
        // Em produção na Vercel: a rota de busca PJe roda nativamente na Vercel em SP (IP Brasil)
        if (endpoint === "/api/search-pje") {
          return "/api/search-pje";
        }
        baseUrl = "https://jud-legal.onrender.com";
      }
    } else {
      if (endpoint === "/api/search-pje") {
        return "/api/search-pje";
      }
      baseUrl = "https://jud-legal.onrender.com";
    }
  }

  if (!endpoint) return baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};


