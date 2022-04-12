import { createDbWorker } from "sql.js-httpvfs";

declare var __MODE__: string;

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
        from: "inline",
        config: {
          serverMode: "full", // file is just a plain old full sqlite database
          requestChunkSize: 4096, // the page size of the  sqlite database (by default 4096)
          url: (__MODE__ === "production") ? "https://data.infinitenovelty.com/file/iabi-data/db.sqlite" : "db.sqlite"
        }
      }
      // {
      //   from: "jsonconfig",
      //   configUrl: "https://data.infinitenovelty.com/file/iabi-data/config.json"
      // }
    ],
    workerUrl.toString(),
    wasmUrl.toString(),
  );
  return worker;
}

export { initWorker };
