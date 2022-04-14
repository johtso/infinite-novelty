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
import { initWorker, queries, Image, Cursor, QUERY_NAMES } from "./db";
import { init } from "commandbar";
init('a38a2a14');
window.CommandBar.boot('foo');

window.CommandBar.addRouter(router);


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
    cursor = {"faves": image.faves, "views": image.views, "comments": image.comments, "id": image.id, "rowid": image.rowid};
  }
  if (cursor) {
    newHash += '/' + objToBase64(cursor);
  }

  location.hash = newHash;
}

const ROUTES = QUERY_NAMES;
type Route = typeof ROUTES[number];
const DEFAULT_ROUTE: Route = "popular";
var currentRoute: Route = DEFAULT_ROUTE;

function parseURLHash(hash: string): { cursor: Cursor | null, route: Route | null } {
  if (hash.length > 1) {
    let route: Route | null = null;
    let [rawRoute, b64] = hash.substring(1).split("/");
    let cursor = null;
    if (b64) {
      cursor = base64ToObj(b64);
    }
    if (!ROUTES.includes(rawRoute)) {
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


var gallery = null as Masonry | null;

function initialise(
    worker: WorkerHttpvfs,
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
  
  const noopPromise = new Promise((resolve) => {resolve(null)});
  var lastQuery: Promise<any> = noopPromise;
  var currentCursor: Cursor | null = parseCurrentURLHash().cursor;
  gallery.addEventListener('pagination', function (ev) {
    // get the new cursor from the return value of the last query
    let isInitialPage = (ev.detail.offset == 0);
    lastQuery = lastQuery.then(() => {
      if (ev.detail.offset && !currentCursor) {
        console.log("no cursor");
      }
      queries[currentRoute](worker, ev.detail.limit, currentCursor, isInitialPage)
        .then(({ images, cursor }) => {
          for (let image of images) {
            allImages[image.id] = image;
          }
          currentCursor = cursor;
          gallery.addItems(images.map(marshalPhoto));
        });
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
    currentRoute = route;
    if (!gallery) {
      gallery = initialise(worker, allImages);
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
