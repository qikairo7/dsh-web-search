/** Select the DeepSeek search auth header for a DSH token or API key. */
export function deepseekAuthHeaders(token) {
  return typeof token === 'string' && token.startsWith('sk-')
    ? { authorization: `Bearer ${token}` }
    : { 'x-dsh-auth-token': token };
}
