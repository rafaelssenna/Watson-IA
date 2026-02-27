import { tokenManager } from "./tokenManager";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1";

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    isFormData = false
  ): Promise<{ data: T; status: number }> {
    const { skipAuth, ...fetchOptions } = options;

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for non-FormData requests
    if (!isFormData) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    // Add auth token if available and not skipped
    if (!skipAuth) {
      const accessToken = tokenManager.getAccessToken();
      if (accessToken) {
        (headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 - try to refresh token (only once)
      if (response.status === 401 && !skipAuth) {
        try {
          await tokenManager.refreshToken();
          // Retry the request with skipAuth to prevent further loops
          return this.request(endpoint, { ...options, skipAuth: true });
        } catch {
          // Refresh failed - clear local state only, do NOT make API calls
          // (calling tokenManager.logout() here would trigger infinite loop)
          console.log("[api] Token refresh failed, clearing local auth state");
        }
      }

      throw {
        response: { data, status: response.status },
        message: data.error?.message || "Request failed",
      };
    }

    return { data, status: response.status };
  }

  async get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, body?: any, options?: RequestOptions) {
    const isFormData = body instanceof FormData;
    return this.request<T>(
      endpoint,
      {
        ...options,
        method: "POST",
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      },
      isFormData
    );
  }

  async patch<T>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE_URL);
