export class TurnCancellationRegistry {
  private readonly active = new Map<string, AbortController>();

  start(turnId: string): AbortSignal {
    if (this.active.has(turnId)) {
      throw new Error(`assistant turn already active: ${turnId}`);
    }
    const controller = new AbortController();
    this.active.set(turnId, controller);
    return controller.signal;
  }

  cancel(turnId: string): boolean {
    const controller = this.active.get(turnId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  finish(turnId: string): void {
    this.active.delete(turnId);
  }
}
