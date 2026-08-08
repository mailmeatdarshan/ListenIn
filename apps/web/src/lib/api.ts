import { useAuthStore } from "./stores/auth-store";

export function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:4001/api/v1";
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return `http://${hostname}:4001/api/v1`;
    }
  }

  return "http://localhost:4001/api/v1";
}

const API_URL = getApiUrl();

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const { accessToken, logout, updateToken, refreshToken: currentRefresh } = useAuthStore.getState();
  const baseUrl = getApiUrl();

  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && currentRefresh) {
    // Attempt to refresh token
    try {
      const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefresh })
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        updateToken(data.accessToken);
        
        // Retry original request
        headers.set("Authorization", `Bearer ${data.accessToken}`);
        return fetch(`${baseUrl}${endpoint}`, { ...options, headers });
      } else {
        logout();
        throw new Error("Session expired");
      }
    } catch (err) {
      logout();
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "An error occurred");
  }

  return response.json();
}
