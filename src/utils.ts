function idFromFlickrUrl(url: string) {
  let matches = url.match(/live\.staticflickr\.com\/.+\/(.*?)_.*\.jpg/);
  if (matches) {
    return matches[1];
  }
}

function flickrThumbUrl(id: string, server: string, secret: string) {
  return `https://live.staticflickr.com/${server}/${id}_${secret}_b_d.jpg`;
}

function flickrOrigUrl(id: string, server: string, original_secret: string) {
  return `https://live.staticflickr.com/${server}/${id}_${original_secret}_o.jpg`;
}

function apply<T extends unknown[], U extends unknown[], R>(fn: (...args: [...T, ...U]) => R, ...front: T) {
  return (...tailArgs: U) => fn(...front, ...tailArgs);
}

export {
  idFromFlickrUrl,
  flickrThumbUrl,
  flickrOrigUrl,
  apply
}
