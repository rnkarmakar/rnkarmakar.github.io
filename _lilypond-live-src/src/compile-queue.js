// Never run two LilyPond instances concurrently or build a backlog of old edits.
export class CompileQueue {
  constructor({ send, result, settled = () => {} }) {
    Object.assign(this, { send, result, settled });
    this.desiredId = 0;
    this.active = null;
    this.pending = null;
  }
  invalidate(id) {
    this.desiredId = id;
    this.pending = null;
  }
  submit(request) {
    if (request.id !== this.desiredId) return;
    this.pending = request;
    this.drain();
  }
  drain() {
    if (this.active || !this.pending) return;
    this.active = this.pending;
    this.pending = null;
    this.send(this.active);
  }
  receive(data) {
    if (!this.active || data.id !== this.active.id) return;
    if (data.type !== 'compiled' && data.type !== 'error') return;
    const request = this.active;
    this.active = null;
    this.settled(data, request);
    if (data.id === this.desiredId) this.result(data, request);
    this.drain();
  }
}
