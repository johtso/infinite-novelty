import { createDbWorker } from "sql.js-httpvfs";

// sadly there's no good way to package workers and wasm directly so you need a way to get these two URLs from your bundler.
// This is the webpack5 way to create a asset bundle of the worker and wasm:
const workerUrl = new URL(
  "sql.js-httpvfs/dist/sqlite.worker.js",
  import.meta.url,
);
const wasmUrl = new URL(
  "sql.js-httpvfs/dist/sql-wasm.wasm",
  import.meta.url,
);
// the legacy webpack4 way is something like `import wasmUrl from "file-loader!sql.js-httpvfs/dist/sql-wasm.wasm"`.

async function initWorker() {
  const worker = await createDbWorker(
    [
      {
        from: "jsonconfig",
        configUrl: "https://data.infinitenovelty.com/file/iabi-data/config.json"
      }
    ],
    workerUrl.toString(),
    wasmUrl.toString(),
  );
  return worker;
}

export { initWorker };
