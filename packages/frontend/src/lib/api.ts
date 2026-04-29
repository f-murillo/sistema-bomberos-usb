import { auth } from '@/config/firebase';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://sistema-bomberos-usb.onrender.com';

/**
 * Función base para hacer peticiones al backend autenticadas
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  
  // Obtenemos el token de Firebase para enviarlo en las cabeceras
  const token = user ? await user.getIdToken() : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Si el backend devuelve un error (4xx o 5xx)
  if (!response.ok) {
    let errorMessage = 'Error en la petición al servidor';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // Si no hay JSON en el error, nos quedamos con el mensaje por defecto
    }
    throw new Error(errorMessage);
  }

  // Si la respuesta es exitosa pero no tiene cuerpo (ej: 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Utilidades específicas para cada método HTTP
 */
export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
  
  post: <T>(endpoint: string, body: any) => 
    apiFetch<T>(endpoint, { 
      method: 'POST', 
      body: JSON.stringify(body) 
    }),
  
  put: <T>(endpoint: string, body: any) => 
    apiFetch<T>(endpoint, { 
      method: 'PUT', 
      body: JSON.stringify(body) 
    }),

  patch: <T>(endpoint: string, body: any) => 
    apiFetch<T>(endpoint, { 
      method: 'PATCH', 
      body: JSON.stringify(body) 
    }),
  
  delete: <T>(endpoint: string) => 
    apiFetch<T>(endpoint, { method: 'DELETE' }),
};