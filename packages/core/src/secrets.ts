export interface SecretStore {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  list(): string[];
}
