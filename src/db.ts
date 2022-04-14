import { createDbWorker, WorkerHttpvfs } from "sql.js-httpvfs";
import { query } from 'sqliterally';

import { apply } from './utils';

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
          url: (__MODE__ === "production") ? "https://data.infinitenovelty.com/file/iabi-data/db.3.sqlite" : "db.sqlite"
          // url: "https://data.infinitenovelty.com/file/iabi-data/db.2.sqlite"
        }
      }
      // {
      //   from: "jsonconfig",
      //   configUrl: "https://data.infinitenovelty.com/file/iabi-data/db.2.30MB/config.json"
      // }
    ],
    workerUrl.toString(),
    wasmUrl.toString(),
  );
  return worker;
}

interface Image {
  rowid: number;
  id: string;
  server: string;
  secret: string;
  original_secret: string;
  width: number;
  height: number;
  faves: number;
  comments: number;
  views: number;
}

type Cursor = Pick<Image, "faves" | "views" | "comments" | "id" | "rowid">;


async function cursorQuery(randomStart: boolean, order: {fields: (keyof Cursor)[], direction: "asc" | "desc"}, where: string | null, worker: WorkerHttpvfs, limit: number, cursor: Cursor | null, initial: boolean): Promise<{ images: Image[], cursor: Cursor }> {
  let images;
  if (limit < 1) {
    throw "limit must be a positive number";
  }

  console.log({where, limit, order})

  let q = query
    .select`rowid, *`
    .from`images`
    .limit([`${limit}`])
    .orderBy([order.fields.map(f => `${f} ${order.direction}`).join(", ")]);
  
  if (where) {
    q = q.where([where]);
  }
    
  if (cursor) {
    let comparator = {"asc": ">", "desc": "<"}[order.direction];
    if (initial) {
      comparator += "=";
    }
    let fieldString = order.fields.join(", ");
    let valueString = order.fields.map(field => cursor[field]).join(", ");
    q = q.where([`(${fieldString}) ${comparator} (${valueString})`]);
  } else {
    if (randomStart) {
      q = q.where(["(rowid >= abs(random() % (select max(rowid) from images)))"]);
    }
  }
    
  let qObj = q.build();
  console.log(q.build().sql)
  console.log(qObj);
  images = await worker.db.query(qObj.sql, qObj.values) as Image[];
  let lastImage = images[images.length - 1];
  let newCursor: Cursor = {
    "faves": lastImage.faves,
    "views": lastImage.views,
    "comments": lastImage.comments,
    "id": lastImage.id,
    "rowid": lastImage.rowid,
  };
    
  return {
    'images': images,
    'cursor': newCursor
  }
}

let randomCursorQuery = apply(cursorQuery, true, {fields: ["rowid"], direction: "asc"})

const QUERY_NAMES = ["random", "randompopular", "randomoverlooked", "popular"];
type QueryName = typeof QUERY_NAMES[number];

let queries = {
  "random": apply(randomCursorQuery, null),
  "randompopular": apply(randomCursorQuery,  "faves > 0"),
  "randomoverlooked": apply(randomCursorQuery, "views < 50 and faves = 0"),
  "popular": apply(cursorQuery, false, {fields: ["faves", "views", "comments", "id"], direction: "desc"}, "faves > 0"),
} as {[key in QueryName]: (worker: WorkerHttpvfs, limit: number, cursor: Cursor | null, initial: boolean) => Promise<{ images: Image[], cursor: Cursor }>};

export { initWorker, queries, Image, Cursor, QUERY_NAMES };
