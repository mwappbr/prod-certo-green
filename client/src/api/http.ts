import { isApiErrorBody, ClientApiError, mapApiError } from './errors';

export async function getApiJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw mapApiError(error);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (response.ok) throw new ClientApiError('INTERNAL', 'O servidor retornou uma resposta inválida.');
    throw mapApiError(error);
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) throw new ClientApiError(payload.error.code, payload.error.message);
    throw new ClientApiError('INTERNAL', 'Não foi possível carregar os dados. Tente novamente.');
  }
  return payload as T;
}
