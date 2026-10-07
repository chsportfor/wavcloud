'use strict';

// A scan publishes a complete snapshot, while uploads remain immediately visible.
// Uploads made after discovery started must also survive the snapshot commit.
function createLibraryStore() {
  const libraries = new Map();
  const scans = new Map();
  const get = (username) => libraries.get(username) || new Map();
  return {
    tracks: (username) => [...get(username).values()],
    track: (username, id) => get(username).get(id),
    beginScan(username) {
      if (scans.has(username)) throw new Error('A library scan is already running');
      const scan = { username, uploads: new Map() };
      scans.set(username, scan);
      return scan;
    },
    commitScan(scan, tracks) {
      if (scans.get(scan.username) !== scan) throw new Error('Stale library scan');
      const next = new Map(tracks.map((track) => [track.id, track]));
      for (const [id, track] of scan.uploads) next.set(id, track);
      libraries.set(scan.username, next);
      scans.delete(scan.username);
      return [...next.values()];
    },
    cancelScan(scan) {
      if (scans.get(scan.username) === scan) scans.delete(scan.username);
    },
    upsert(username, tracks) {
      const library = get(username);
      for (const track of tracks) {
        library.set(track.id, track);
        scans.get(username)?.uploads.set(track.id, track);
      }
      libraries.set(username, library);
      return [...library.values()];
    },
  };
}

module.exports = { createLibraryStore };
