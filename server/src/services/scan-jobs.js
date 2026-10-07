'use strict';
const { randomUUID } = require('node:crypto');

function createScanJobs(scan) {
  const jobs = new Map();
  const snapshot = (job) => ({ ...job.state });
  return {
    get(username) {
      const job = jobs.get(username);
      return job ? snapshot(job) : { status: 'idle' };
    },
    start(username, directory) {
      const previous = jobs.get(username);
      if (previous?.state.status === 'running') return previous;
      const job = {
        state: {
          id: randomUUID(),
          status: 'running',
          phase: 'discovering',
          discovered: 0,
          processed: 0,
          total: null,
          found: 0,
          failed: 0,
          currentFile: '',
        },
      };
      jobs.set(username, job);
      job.promise = Promise.resolve()
        .then(() =>
          scan(username, directory, (progress) => {
            Object.assign(job.state, progress);
          }),
        )
        .then((tracks) => {
          Object.assign(job.state, {
            status: 'completed',
            phase: 'completed',
            found: tracks.length,
            currentFile: '',
          });
          return tracks;
        })
        .catch((error) => {
          Object.assign(job.state, {
            status: 'failed',
            phase: 'failed',
            currentFile: '',
            error: '라이브러리 스캔에 실패했습니다.',
          });
          console.error('Library scan failed:', error);
          throw error;
        });
      // Background callers do not await the job; the legacy route still can.
      job.promise.catch(() => {});
      job.snapshot = () => snapshot(job);
      return job;
    },
  };
}

module.exports = { createScanJobs };
