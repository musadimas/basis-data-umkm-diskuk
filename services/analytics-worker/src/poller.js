export class JobPoller {
  constructor({ queue, concurrency, pollMs, handle, logger, stopTimeoutMs = 110_000 }) {
    this.queue = queue;
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.pollMs = pollMs;
    this.handle = handle;
    this.logger = logger;
    this.stopTimeoutMs = stopTimeoutMs;
    this.active = new Set();
    this.claimInFlight = false;
    this.stopping = false;
    this.timer = null;
  }
  async tick() {
    if (this.stopping || this.claimInFlight || this.active.size >= this.concurrency)
      return;
    this.claimInFlight = true;
    try {
      const jobs = await this.queue.claim(this.concurrency - this.active.size);
      const handled = [];
      for (const job of jobs) {
        if (this.stopping || this.active.size >= this.concurrency) break;
        handled.push(job.id);
        this.active.add(job.id);
        void this.run(job);
      }
      if (handled.length < jobs.length) await this.release(jobs.slice(handled.length));
    } catch (error) {
      this.logger.error("queue_tick_failed", {
        errorCode: error?.code || "QUEUE_FAILED",
      });
    } finally {
      this.claimInFlight = false;
    }
  }
  async run(job) {
    try {
      await this.handle(job);
    } catch (error) {
      this.logger.error("job_handler_failed", {
        errorCode: error?.code || "JOB_FAILED",
        jobId: job?.id,
      });
    } finally {
      this.active.delete(job.id);
    }
  }
  async release(jobs) {
    const ids = jobs.map((job) => job?.id).filter((id) => id != null);
    if (!ids.length) return;
    try {
      await this.queue.release(ids);
    } catch (error) {
      this.logger.error("queue_release_failed", {
        errorCode: error?.code || "QUEUE_FAILED",
        releasedCount: ids.length,
      });
    }
  }
  start() {
    if (this.timer || this.stopping) return;
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    void this.tick();
  }
  async stop(timeoutMs = this.stopTimeoutMs) {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const deadline = Date.now() + timeoutMs;
    while ((this.active.size > 0 || this.claimInFlight) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 25));
    return this.active.size;
  }
}
