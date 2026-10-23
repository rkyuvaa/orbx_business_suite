import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Access Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Enforce Automated Refresh with Daily 4:00 AM Cutoff Handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 Unauthorized
    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail || '';
      const isDailyReset = typeof detail === 'string' && (detail.includes('4:00 AM') || detail.includes('reset'));

      // If backend explicitly rejected due to daily 4:00 AM cutoff, abort immediately without refresh
      if (isDailyReset) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?reason=daily_reset';
        }
        return Promise.reject(error);
      }

      // If request has not been retried yet, attempt refresh
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (refreshToken) {
          try {
            const res = await axios.post(`/api/v1/auth/refresh?refresh_token_str=${refreshToken}`);
            
            if (res.status === 200) {
              const { access_token, refresh_token } = res.data;
              
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', refresh_token);
              
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return apiClient(originalRequest);
            }
          } catch (refreshError) {
            const refreshDetail = refreshError.response?.data?.detail || '';
            const reason = typeof refreshDetail === 'string' && refreshDetail.includes('4:00 AM')
              ? 'daily_reset'
              : 'session_expired';

            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            if (!window.location.pathname.startsWith('/login')) {
              window.location.href = `/login?reason=${reason}`;
            }
            return Promise.reject(refreshError);
          }
        }
      }

      // If no refresh token or already retried
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?reason=session_expired';
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
