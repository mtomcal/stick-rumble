export function adaptGameplayEvent<T>(data: unknown): T {
  return data as T;
}
