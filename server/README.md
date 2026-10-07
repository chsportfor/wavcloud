# WavCloud server

Maintain `src/`, the readable CommonJS JavaScript reconstructed from the deployed runtime.
The original TypeScript project was not found. `node scripts/build.js` validates source syntax
and generates `dist/`; `node scripts/build.js --check` verifies the generated files exactly match.
The server's `.env` and music files are not included.

Run `npm test` for the server regression suite and `npm run build` to regenerate the runtime.
Production already has the pinned dependencies from
`package-lock.json`; `npm ci` is needed on a clean machine.

The server keeps converting uploaded and scanned WAV files to FLAC. Conversion
publishes a verified FLAC before removing the WAV. A same-named FLAC is treated
as a collision, so neither file is overwritten or removed. Uploads first write
to a hidden temporary file and publish without replacing an existing file.

Some existing FLAC Vorbis comments contain CP949 bytes rather than the UTF-8
required by the format. When the parsed artist contains replacement characters,
the server reads that comment's original bytes and attempts a strict CP949
decode. It does not rewrite the music file. Valid UTF-8 tags are left alone.

Track titles use a valid embedded TITLE tag first. When the tag is missing or
damaged, the server retains its filename-derived title. This preserves titles
with ` - ` inside them, such as `The Lamia 170 - Resurrection`.

`POST /api/tracks/scan/start` starts a background scan and returns its job state
immediately. `GET /api/tracks/scan/status` returns that user's current job,
including discovery, conversion and metadata progress. Repeated starts share
the running job. Completed tracks replace the cached library only after a
successful scan; an inaccessible directory preserves the previous library.
The existing `POST /api/tracks/scan` still waits and returns the track list.

`services/library-store.js` owns in-memory library snapshots and track lookup.
It merges uploads made while a scan is running into the completed snapshot,
and preserves the previous library when a scan fails. `utils/byte-range.js`
handles single HTTP byte ranges, including suffixes and clipped end positions.
Fastify owns direct stream responses and error/disconnect handling.

Login bodies and folder names are validated before use. Uploads accept the five
indexed audio extensions and return 400 for empty files, 413 for oversized files,
415 for unsupported formats and 409 for name collisions. Failed upload temporary
files are cleaned before returning the failure response.

Do not deploy `config.js` or `.env` as part of a file-safety change. The
`scripts/deploy.sh` script checks the expected production hashes, runs the
server tests, backs up replaced files, and restores them if startup or Nginx
validation fails. Deployment scripts describe specific verified changes; prepare current expected hashes
and a backup/rollback plan before a new deployment.

Startup restores validated metadata from `LIBRARY_CACHE_DIR` (default `.library-cache` under the server
working directory), opens the API and refreshes libraries in the background. Startup and HTTP scans
share `library-manager.js`. Unchanged file size, mtime and external-cover fingerprints reuse metadata.
Missing music directories preserve restored libraries. A cold library returns 503 with
`LIBRARY_NOT_READY` until the first successful scan; a failed cold scan returns `LIBRARY_UNAVAILABLE`.
Scan status includes `libraryReady`, `fromSnapshot` and `reused`. Snapshot writes are serialized
and published atomically; concurrent uploads are included. Production retained 1,042 tracks and
returned the library about one second after a verified warm restart.
