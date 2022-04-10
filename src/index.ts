import "./style.css";

import { createDbWorker, WorkerHttpvfs } from "sql.js-httpvfs";
import { Masonry } from "@ecodev/natural-gallery-js";
import { debounce } from "ts-debounce";
import "../node_modules/@ecodev/natural-gallery-js/natural-gallery.css";
import "photoswipe/dist/photoswipe.css";
import "photoswipe/dist/default-skin/default-skin.css";
import PhotoSwipe from "photoswipe";
import {
  idFromFlickrUrl,
  flickrThumbUrl,
  flickrOrigUrl,
} from "./utils";
import { initWorker } from "./db";


interface Image {
  random_id: number;
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

async function popularQuery(worker: WorkerHttpvfs, limit: number, cursor?: Cursor | null, initial?: boolean): Promise<{ images: Image[], cursor: Cursor }> {
  let images;
  if (limit < 1) {
    throw "limit must be a positive number";
  }

  if (cursor) {
    let [faves, views, comments, id] = cursor;
    // if this is the initial data load we want to include the current image
    let comparator = initial ? "<=" : "<";
    images = await worker.db.query(`
      select
        views, faves, comments, id, server, secret, original_secret, width, height, random_id from images
      where
        (faves, views, comments, id) ${comparator} (${faves}, ${views}, ${comments}, '${id}')
      order by
        faves desc, views desc, comments desc, id desc
      limit ${limit};`) as Image[];
  } else {
    images = await worker.db.query(`
      select
        views, faves, comments, id, server, secret, original_secret, width, height, random_id from images
      order by
        faves desc, views desc, comments desc, id desc
      limit ${limit};`) as Image[];
  }

  let lastImage = images[images.length - 1];
  let newCursor: Cursor = [lastImage.faves, lastImage.views, lastImage.comments, lastImage.id, lastImage.random_id];
  return {
    'images': images,
    'cursor': newCursor
  }
}

function randomNumbers(max: number, count: number) {
  let result = [];
  for (let i = 0; i < count; i++) {
    result.push(Math.floor(Math.random() * max));
  }
  return result;
}

async function randomQuery(worker: WorkerHttpvfs, limit: number, cursor?: Cursor | null, initial?: boolean): Promise<{ images: Image[], cursor: Cursor }> {
  let images;
  if (limit < 1) {
    throw "limit must be a positive number";
  }

  if (cursor) {
    let [faves, views, comments, id, random_id] = cursor;
    // if this is the initial data load we want to include the current image
    let comparator = initial ? ">=" : ">";
    images = await worker.db.query(`
      select
        views, faves, comments, id, server, secret, original_secret, width, height, random_id from images
      where
        random_id ${comparator} ${random_id}
      limit ${limit};`) as Image[];
  } else {
    images = await worker.db.query(`
      select
        views, faves, comments, id, server, secret, original_secret, width, height, random_id from images
      where
        random_id > abs(random() % (select max(random_id) from images))
      limit ${limit};`) as Image[];
  }

  let lastImage = images[images.length - 1];
  let newCursor: Cursor = [lastImage.faves, lastImage.views, lastImage.comments, lastImage.id, lastImage.random_id];
  return {
    'images': images,
    'cursor': newCursor
  }
}


function marshalPhoto(image: Image) {
  return {
    thumbnailSrc: flickrThumbUrl(image.id, image.server, image.secret),
    enlargedSrc: flickrOrigUrl(image.id, image.server, image.original_secret),
    enlargedWidth: image.width,
    enlargedHeight: image.height,
    // title: `<a href="https://www.flickr.com/photos/${image.id}">https://www.flickr.com/photos/${image.id}</a>`,
    // link: data.link,
    id: image.id,
    link: `https://www.flickr.com/photos/internetarchivebookimages/${image.id}`,
    linkTarget: "_blank" as const, // _blank | _top | _self | _parent
    // color: string // HEX color for background before image display
  }
}

function objToBase64(obj: any) {
  let jsonEncoded = JSON.stringify(obj);
  return btoa(jsonEncoded);
}

function base64ToObj(base64: string) {
  let json = atob(base64);
  return JSON.parse(json);
}

var million = { id: "16706133232", server: "8645", secret: "8917aa0792", original_secret: "2c38e0ccb2", width: 496, height: 212, faves: 0, comments: 0, views: 702 };
var tenThousand = { id: "21272868031", server: "5700", secret: "6e7eb06136", original_secret: "b64fcb8bcc", width: 1564, height: 1784, faves: 2, comments: 0, views: 1352 };

type Cursor = [Image["faves"], Image["views"], Image["comments"], Image["id"], Image["random_id"]];


function updateUrlHash(image: Image) {
  let cursor = [image.faves, image.views, image.comments, image.id, image.random_id];
  let currentRoute = parseCurrentURLHash()['route'];
  let base64 = objToBase64(cursor);
  if (currentRoute) {
    window.history.replaceState({}, "", `#${currentRoute}/${base64}`);
  } else {
    window.history.replaceState({}, "", `#${base64}`);
  }
}

function parseCurrentURLHash(): { cursor: Cursor | null, route: "random" | "popular" | null } {
  let hash = window.location.hash;
  if (hash.length > 1) {
    let route: "random" | "popular" | null = null;
    let [rawRoute, b64] = hash.substring(1).split("/");
    let cursor = null;
    if (b64) {
      cursor = base64ToObj(b64);
    }
    if (!["random", "popular"].includes(rawRoute)) {
      route = null;
    } else {
      route = rawRoute as "random" | "popular";
    }
    return {route, cursor};
  } else {
    return {route: null, cursor: null};
  }
}

async function main() {
  const worker = await initWorker();
  var allImages = {} as { [id: string]: Image };
  // get location anchor
  let anchor = new URL(window.location.href).hash.substring(1);
  let currentURL = parseCurrentURLHash();
  // var initialCursor: Cursor | null = null;;
  // if (anchor) {
  //   initialCursor = base64ToObj(anchor);
  // }
  let initialCursor: Cursor | null = null;
  if (currentURL?.cursor) {
    initialCursor = currentURL.cursor;
  }

  let routeMap = {
    "random": randomQuery,
    "popular": popularQuery,
  }

  let route = currentURL?.route || "popular";
  let query = routeMap[route];

  let { images, cursor } = await query(worker, 10, initialCursor, true);
  for (let image of images) {
    allImages[image.id] = image;
  }
  let cursors = { "10": cursor } as { [key: string]: Cursor };
  var elementRef = document.getElementById('gallery') as HTMLElement;
  var photoswipeRef = document.getElementsByClassName('pswp')[0] as HTMLElement;

  var gallery = new Masonry(
    elementRef,
    {
      // 'rowHeight': 500,
      'columnWidth': 500,
      'lightbox': true,
      'showLabels': 'never',
      'infiniteScrollOffset': -800,
      'activable': false,
    },
    photoswipeRef
  );

  gallery.init();
  gallery.addItems(images.map(marshalPhoto));


  function onScroll(event: Event) {
    let firstColumn = document.querySelector(".column") as HTMLElement;
    let imageElements = firstColumn.querySelectorAll(".figure.loaded");
    let firstVisible = Array.from(imageElements).find(el => {
      let rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    if (firstVisible) {
      let img = firstVisible.querySelector(".image") as HTMLElement;
      // get background image url from img element
      let bgImg = img.style.backgroundImage;
      // remove url(...) from background image
      bgImg = bgImg.substring(4, bgImg.length - 1);
      // get id from url
      let flickrId = idFromFlickrUrl(bgImg) as string;
      let image = allImages[flickrId];
      updateUrlHash(image);
    }
  }

  // on scroll event debounced
  let debouncedOnScroll = debounce(onScroll, 100);
  window.addEventListener('scroll', debouncedOnScroll);


  // whenever the user scrolls the page, find the first image visible in the viewport and update the anchor

  gallery.addEventListener('pagination', function (ev) {
    console.log("pagination", ev.detail);

    let cursor = cursors[ev.detail.offset.toString()];

    // set location anchor to the cursor
    console.assert(cursor);

    query(worker, ev.detail.limit, cursor)
      .then(({ images, cursor }) => {
        for (let image of images) {
          allImages[image.id] = image;
        }
        cursors[ev.detail.offset + ev.detail.limit] = cursor;
        gallery.addItems(images.map(marshalPhoto));
      });
  });

  var photoswipe: PhotoSwipe<any>;
  var linkButton = document.getElementsByClassName('link_button')[0] as HTMLElement;
  gallery.addEventListener('zoom', function (evt) {
    photoswipe = evt.detail.photoswipe;
    linkButton.addEventListener('click', function (evt) {
      let currentItem = photoswipe.currItem;
      let src = currentItem.src;
      if (src) {
        let flickrId = idFromFlickrUrl(src);
        if (flickrId) {
          let flickrPageUrl = `https://www.flickr.com/photos/internetarchivebookimages/${flickrId}`;
          window.open(flickrPageUrl, "_blank");
        }
      }
    });
  });
}

main();
