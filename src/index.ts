import "./style.css";

import { createDbWorker, WorkerHttpvfs } from "sql.js-httpvfs";
import { Masonry } from "@ecodev/natural-gallery-js";
import { debounce } from "ts-debounce";
import "../node_modules/@ecodev/natural-gallery-js/natural-gallery.css";
import "photoswipe/dist/photoswipe.css";
import "photoswipe/dist/default-skin/default-skin.css";
import PhotoSwipe from "photoswipe";
// import "ninja-keys";
import {
  idFromFlickrUrl,
  flickrThumbUrl,
  flickrOrigUrl,
} from "./utils";
import { initWorker } from "./db";
// import { NinjaKeys } from "ninja-keys";
import { init } from "commandbar";
init('a38a2a14');
window.CommandBar.boot('foo');

window.CommandBar.addRouter(router);

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
// const ninja = document.querySelector('ninja-keys') as NinjaKeys;
// ninja.data = [
//   {
//     id: 'Random',
//     title: 'Show random images',
//     mdIcon: 'casino',
//     // parent: 'Theme',
//     handler: () => {
//       updateUrlHash(null, "random");
//     },
//   },
//   {
//     id: 'Most Popular',
//     title: 'Show most popular images',
//     mdIcon: 'favorite',
//     // parent: 'Theme',
//     handler: () => {
//       updateUrlHash(null, "popular");
//     },
//   },
//   {
//     id: 'Random Popular',
//     title: 'Show random images that have be favourited by at least one user',
//     mdIcon: 'favorite',
//     // parent: 'Theme',
//     handler: () => {
//       updateUrlHash(null, "randompopular");
//     },
//   },
// ];

async function popularQuery(worker: WorkerHttpvfs, limit: number, cursor?: Cursor | null, initial?: boolean): Promise<{ images: Image[], cursor: Cursor }> {
  let images;
  if (limit < 1) {
    throw "limit must be a positive number";
  }

  if (cursor) {
    let [faves, views, comments, id, rowid] = cursor;
    // if this is the initial data load we want to include the current image
    let comparator = initial ? "<=" : "<";
    images = await worker.db.query(`
      select
        rowid, * from images
      where
        ((faves, views, comments, id) ${comparator} (${faves}, ${views}, ${comments}, '${id}')) and faves > 0
      order by
        faves desc, views desc, comments desc, id desc
      limit ${limit};`) as Image[];
  } else {
    images = await worker.db.query(`
      select
        rowid, * from images
      where
        faves > 0
      order by
        faves desc, views desc, comments desc, id desc
      limit ${limit};`) as Image[];
  }

  let lastImage = images[images.length - 1];
  let newCursor: Cursor = [lastImage.faves, lastImage.views, lastImage.comments, lastImage.id, lastImage.rowid];
  return {
    'images': images,
    'cursor': newCursor
  }
}

async function randomPopularQuery(worker: WorkerHttpvfs, limit: number, cursor?: Cursor | null, initial?: boolean): Promise<{ images: Image[], cursor: Cursor }> {
  let images;
  if (limit < 1) {
    throw "limit must be a positive number";
  }

  if (cursor) {
    let [faves, views, comments, id, rowid] = cursor;
    // if this is the initial data load we want to include the current image
    let comparator = initial ? ">=" : ">";
    images = await worker.db.query(`
      select
        rowid, * from images
      where
        (rowid ${comparator} ${rowid}) and faves > 0
      order by
        rowid
      limit ${limit};`) as Image[];
  } else {
    images = await worker.db.query(`
      select
        rowid, * from images
      where
        (rowid >= abs(random() % (select max(rowid) from images))) and faves > 0
      order by
        rowid
      limit ${limit};`) as Image[];
  }

  let lastImage = images[images.length - 1];
  let newCursor: Cursor = [lastImage.faves, lastImage.views, lastImage.comments, lastImage.id, lastImage.rowid];
  return {
    'images': images,
    'cursor': newCursor
  }
}

async function randomQuery(worker: WorkerHttpvfs, limit: number, cursor?: Cursor | null, initial?: boolean): Promise<{ images: Image[], cursor: Cursor }> {
  let images;
  if (limit < 1) {
    throw "limit must be a positive number";
  }

  if (cursor) {
    let [faves, views, comments, id, rowid] = cursor;
    // if this is the initial data load we want to include the current image
    let comparator = initial ? ">=" : ">";
    images = await worker.db.query(`
      select
        rowid, * from images
      where
        rowid ${comparator} ${rowid}
      order by
        rowid
      limit ${limit};`) as Image[];
  } else {
    images = await worker.db.query(`
      select
        rowid, * from images
      where
        rowid > abs(random() % (select max(rowid) from images))
      order by
        rowid
      limit ${limit};`) as Image[];
  }

  let lastImage = images[images.length - 1];
  let newCursor: Cursor = [lastImage.faves, lastImage.views, lastImage.comments, lastImage.id, lastImage.rowid];
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

type Cursor = [Image["faves"], Image["views"], Image["comments"], Image["id"], Image["rowid"]];


function router(route: string) {
  // check if string is of type Route
  if (parseCurrentURLHash().route !== route) {
    updateUrlHash(null, route as Route);
  }
}

function updateUrlHash(image?: Image | null, route?: Route | null) {
  if (!image && !route) {
    return;
  }
  let currentURL = parseCurrentURLHash();
  let newHash = '#'
  if (!route) {
    route = currentURL.route;
  }
  newHash += route;
  let cursor: Cursor | null = null;
  if (image === undefined) {
    cursor = currentURL.cursor;
  } else if (image === null) {
    cursor = null;
  } else {
    cursor = [image.faves, image.views, image.comments, image.id, image.rowid];
  }
  if (cursor) {
    newHash += '/' + objToBase64(cursor);
  }

  location.hash = newHash;
}

type Route = "popular" | "random" | "randompopular";

function parseURLHash(hash: string): { cursor: Cursor | null, route: Route | null } {
  if (hash.length > 1) {
    let route: Route | null = null;
    let [rawRoute, b64] = hash.substring(1).split("/");
    let cursor = null;
    if (b64) {
      cursor = base64ToObj(b64);
    }
    if (!["random", "popular", "randompopular"].includes(rawRoute)) {
      route = null;
    } else {
      route = rawRoute as Route;
    }
    return {route, cursor};
  } else {
    return {route: null, cursor: null};
  }
}

function parseCurrentURLHash(): { cursor: Cursor | null, route: Route | null } {
  let hash = window.location.hash;
  return parseURLHash(hash);
}

var ROUTES = {
  "random": randomQuery,
  "popular": popularQuery,
  "randompopular": randomPopularQuery,
}
const DEFAULT_ROUTE = "random";

var currentQuery = ROUTES[DEFAULT_ROUTE];
var gallery = null as Masonry | null;

function initialise(
    worker: WorkerHttpvfs,
    cursors: { [key: string]: Cursor },
    allImages: { [id: string]: Image },
    ) {
  let galleryRef = document.getElementById('gallery') as HTMLElement;
  let photoswipeRef = document.getElementsByClassName('pswp')[0] as HTMLElement;
  let gallery = new Masonry(
    galleryRef,
    {
      // 'rowHeight': 500,
      'columnWidth': 400,
      'lightbox': true,
      'showLabels': 'never',
      'infiniteScrollOffset': -1500,
      'activable': false,
      'photoSwipeOptions': {
        'history': false,
      },
    },
    photoswipeRef
  );

  gallery.addEventListener('pagination', function (ev) {
    console.log("pagination", ev.detail);
    
    let cursor = cursors[ev.detail.offset.toString()];

    // set location anchor to the cursor
    if (ev.detail.offset) {
      console.assert(cursor);
    }

    let isInitialPage = (ev.detail.offset == 0);
    if (isInitialPage) {
      let currCursor = parseCurrentURLHash().cursor;
      if (currCursor) {
        cursor = currCursor;
      }
    }
    console.log("pagination cursor", cursor);
    currentQuery(worker, ev.detail.limit, cursor, isInitialPage)
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

  function onFlickrButtonClick(evt: MouseEvent) {
    let currentItem = photoswipe.currItem;
    let src = currentItem.src;
    if (src) {
      let flickrId = idFromFlickrUrl(src);
      if (flickrId) {
        let flickrPageUrl = `https://www.flickr.com/photos/internetarchivebookimages/${flickrId}`;
        window.open(flickrPageUrl, "_blank");
      }
    }
  }

  gallery.addEventListener('zoom', function (evt) {
    photoswipe = evt.detail.photoswipe;
    linkButton.removeEventListener('click', onFlickrButtonClick);
    linkButton.addEventListener('click', onFlickrButtonClick);
  });


  var loadingSpinner = document.getElementsByClassName('loadingspinner')[0] as HTMLElement;
  function onItemDisplayed() {
    loadingSpinner.hidden = true;
  }
  gallery.addEventListener('item-displayed', onItemDisplayed);

  gallery.init();
  return gallery;
}


async function main() {
  const worker = await initWorker();
  var allImages = {} as { [id: string]: Image };
  let cursors = {} as { [key: string]: Cursor };
  
  window.addEventListener('hashchange', function (evt) {
    onHashChange(evt.newURL, evt.oldURL);
  });
  // when we first load trigger a hash change to get things started.
  onHashChange(window.location.toString())
  
  // on scroll event debounced
  let debouncedOnScroll = debounce(onScroll, 100);
  window.addEventListener('scroll', debouncedOnScroll);

  function onHashChange(newURL: string, oldURL?: string) {
    let newRoute = parseURLHash(new URL(newURL).hash).route;
    if (!newRoute) {
      updateUrlHash(undefined, DEFAULT_ROUTE);
      return;
    }

    if (oldURL) {
      let oldRoute = parseURLHash(new URL(oldURL).hash).route;
      if (oldRoute === newRoute) {
        return;
      }
    }
    window.CommandBar.addContext("currentRoute", newRoute);
    onRouteChange(newRoute);
  }

  function onRouteChange(route: Route) {
    currentQuery = ROUTES[route];
    if (!gallery) {
      gallery = initialise(worker, cursors, allImages);
    } else {
      gallery.clear();
      let loadingSpinner = document.getElementsByClassName('loadingspinner')[0] as HTMLElement;
      loadingSpinner.hidden = false;
      window.scrollTo(0, 0);
    }
  }

  // listen for anchor changes

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

}

main();
