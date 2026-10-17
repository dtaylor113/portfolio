const projects = document.querySelector("#projects");
const tabList = document.querySelector(".tabs");
const tabs = [...document.querySelectorAll(".tab")];
const articles = new Map();
let sites = [];

fetch("sites.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load sites.json (${response.status})`);
    }
    return response.json();
  })
  .then(async (data) => {
    sites = Array.isArray(data.sites) ? data.sites.slice() : [];
    sites.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    await showGroup("play");
  })
  .catch((error) => {
    const note = document.createElement("p");
    note.className = "load-error";
    note.textContent = error.message;
    projects.replaceChildren(note);
  });

tabList.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (!tab || tab.getAttribute("aria-selected") === "true") return;
  showGroup(tab.dataset.group);
});

tabList.addEventListener("keydown", (event) => {
  const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  let next = current;
  if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
  else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[next].focus();
  showGroup(tabs[next].dataset.group);
});

async function showGroup(group) {
  document.body.dataset.theme = group;
  tabs.forEach((tab) => {
    const selected = tab.dataset.group === group;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  });
  const selectedTab = tabs.find((tab) => tab.dataset.group === group);
  if (selectedTab) projects.setAttribute("aria-labelledby", selectedTab.id);
  const visible = sites.filter((site) => site.group === group);
  const nodes = await Promise.all(visible.map(articleFor));
  projects.replaceChildren(...nodes);
}

async function articleFor(site) {
  const key = site.id || site.name;
  if (!articles.has(key)) {
    const images = await resolveImages(site);
    articles.set(key, renderSite({ ...site, images }));
  }
  return articles.get(key);
}

function renderSite(site) {
  const article = document.createElement("article");
  article.className = "work";
  if (site.id) article.id = String(site.id);

  const grid = document.createElement("div");
  grid.className = "work-grid";
  grid.append(renderGallery(site), renderCopy(site));
  article.append(grid);
  return article;
}

function renderCopy(site) {
  const copy = document.createElement("div");
  copy.className = "copy";

  const titleRow = document.createElement("div");
  titleRow.className = "title-row";

  const heading = document.createElement("h2");
  heading.textContent = site.name || "Untitled";

  const year = document.createElement("p");
  year.className = "year";
  year.textContent = site.year ? String(site.year) : "";

  titleRow.append(heading, year);
  copy.append(titleRow);

  const links = renderLinks(site);
  if (links) copy.append(links);

  const description = document.createElement("p");
  description.textContent = site.description || "";

  const details = document.createElement("p");
  details.className = "brief";
  details.textContent = site.details || "";

  if (site.description) copy.append(description);
  if (site.details) copy.append(details);
  const points = renderPoints(site);
  if (points) copy.append(points);
  const howItWorks = renderHowItWorks(site);
  if (howItWorks) copy.append(howItWorks);
  return copy;
}

function renderPoints(site) {
  if (site.pointsLabel === "How it works") return null;
  const items = Array.isArray(site.points) ? site.points.filter(Boolean) : [];
  if (!items.length) return null;

  const group = document.createElement(site.collapsed ? "details" : "div");
  group.className = site.description ? "points" : "points points-copy";

  if (site.pointsLabel) {
    const label = document.createElement(site.collapsed ? "summary" : "p");
    label.className = "points-label";
    label.textContent = site.pointsLabel;
    group.append(label);
  }

  const list = document.createElement(site.ordered ? "ol" : "ul");
  items.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.append(entry);
  });
  group.append(list);
  return group;
}

function renderHowItWorks(site) {
  const steps = site.pointsLabel === "How it works" && Array.isArray(site.points)
    ? site.points.filter(Boolean)
    : [];
  const tech = typeof site.architecture === "string" ? site.architecture.trim() : "";
  const source = githubLink(site);
  if (!steps.length && !tech && !source) return null;

  const details = document.createElement("details");
  details.className = "points";

  const summary = document.createElement("summary");
  summary.className = "points-label";
  summary.textContent = "How it works";
  details.append(summary);

  if (steps.length) {
    const list = document.createElement(site.ordered ? "ol" : "ul");
    steps.forEach((item) => {
      const entry = document.createElement("li");
      entry.textContent = item;
      list.append(entry);
    });
    details.append(list);
  }

  if (tech) {
    const note = document.createElement("p");
    note.className = "tech";
    note.textContent = tech;
    details.append(note);
  }

  if (source) {
    const links = document.createElement("p");
    links.className = "links source";
    links.append(source);
    details.append(links);
  }

  return details;
}

function renderLinks(site) {
  const links = document.createElement("p");
  links.className = "links";

  const siteLink = externalLink(site.url, linkLabel(site.url));
  if (siteLink) {
    siteLink.classList.add("site-url");
    links.append(siteLink);
  }

  return links.childElementCount ? links : null;
}

function githubLink(site) {
  const href = typeof site.repository === "string" ? site.repository.trim() : "";
  if (!/^https:\/\/github\.com\//i.test(href)) return null;
  return externalLink(href, href);
}

function linkLabel(href) {
  const text = String(href || "");
  const file = /^files\/(.+)$/i.exec(text);
  return file ? file[1] : text;
}

function externalLink(href, label) {
  if (!href || !isSafeHref(href)) return null;
  const link = document.createElement("a");
  link.href = /^(https?:)?\/\//i.test(href) ? href : encodeURI(href);
  link.textContent = label;
  return link;
}

function isSafeHref(href) {
  if (/^https?:\/\//i.test(href)) return true;
  return /^[\w./ -]+$/.test(href);
}

async function resolveImages(site) {
  const listed = (Array.isArray(site.images) ? site.images : [])
    .filter((image) => image && image.src);
  const folder = site.id ? await listFolderShots(String(site.id)) : [];
  const listedBySrc = new Map(listed.map((image) => [String(image.src), image]));
  const fromFolder = folder.map((image) => listedBySrc.get(image.src) || image);
  const seen = new Set(fromFolder.map((image) => image.src));
  const extras = listed.filter((image) => !seen.has(String(image.src)));
  const images = mixesStillsAndMotion(listed)
    ? authoredOrder(listed, folder)
    : [...fromFolder, ...extras];
  if (images.length) return images;
  return [{ src: "", alt: `${site.name || "Project"} screenshot` }];
}

function mixesStillsAndMotion(listed) {
  let still = false;
  let motion = false;
  listed.forEach((image) => {
    if (isMotion(image)) motion = true;
    else still = true;
  });
  return still && motion;
}

function isMotion(image) {
  const src = image && image.src ? String(image.src) : "";
  return isVideo(src) || Boolean(youtubeId(src));
}

function authoredOrder(listed, folder) {
  const seen = new Set(listed.map((image) => String(image.src)));
  const extras = folder.filter((image) => !seen.has(image.src));
  return [...listed, ...extras];
}

let imageManifest;

function loadImageManifest() {
  if (!imageManifest) {
    imageManifest = fetch("images/manifest.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return imageManifest;
}

async function listFolderShots(id) {
  const listed = await shotsFromDirectory(id);
  if (listed.length) return listed;
  return shotsFromManifest(id);
}

async function shotsFromDirectory(id) {
  const base = `images/${id}/`;
  try {
    const response = await fetch(base, { cache: "no-store" });
    if (!response.ok) return [];
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return [];
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const names = [...doc.querySelectorAll("a")]
      .map((anchor) => filenameFromHref(anchor.getAttribute("href") || ""))
      .filter(isShotFile);
    return shotsFromNames(base, names);
  } catch {
    return [];
  }
}

async function shotsFromManifest(id) {
  const manifest = await loadImageManifest();
  const names = Array.isArray(manifest[id]) ? manifest[id].filter(isShotFile) : [];
  return shotsFromNames(`images/${id}/`, names);
}

function shotsFromNames(base, names) {
  return sortShots(names).map((name) => ({
    src: base + encodeURIComponent(name),
    alt: labelFromFilename(name),
  }));
}

function isShotFile(name) {
  return /\.(png|jpe?g|gif|webp|avif|mp4|webm)$/i.test(name);
}

function filenameFromHref(href) {
  if (!href || href.startsWith("?") || href.startsWith("../") || href.endsWith("/")) return "";
  const path = href.split("?")[0].split("#")[0].split("/").pop();
  if (!path || path === "." || path === "..") return "";
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function sortShots(names) {
  return names.slice().sort((a, b) => {
    const left = shotOrder(a);
    const right = shotOrder(b);
    if (left.numbered !== right.numbered) return left.numbered ? -1 : 1;
    if (left.number !== right.number) return left.number - right.number;
    if (left.rest !== right.rest) return left.rest < right.rest ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

function shotOrder(name) {
  const stem = name.replace(/\.[^.]+$/, "");
  const match = /^(\d+)(.*)$/.exec(stem);
  if (!match) {
    return { numbered: false, number: Number.POSITIVE_INFINITY, rest: "", name: name.toLowerCase() };
  }
  return {
    numbered: true,
    number: Number(match[1]),
    rest: match[2].toLowerCase(),
    name: name.toLowerCase(),
  };
}

function labelFromFilename(name) {
  const stem = name
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[.-]\s*/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (stem && !/^\d+$/.test(stem)) return stem;
  const number = /^(\d+)/.exec(name);
  return number ? `Screenshot ${Number(number[1])}` : name;
}

function renderGallery(site) {
  const images = Array.isArray(site.images) && site.images.length
    ? site.images
    : [{ src: "", alt: `${site.name || "Project"} screenshot` }];

  const gallery = document.createElement("div");
  gallery.className = "gallery";

  const frame = document.createElement("div");
  frame.className = "shot";
  frame.tabIndex = 0;
  frame.setAttribute("aria-live", "polite");

  const media = document.createElement("div");
  media.className = "shot-media";

  const previous = shotNav("Previous image", "prev");
  const next = shotNav("Next image", "next");

  let current = 0;

  function select(index) {
    current = (index + images.length) % images.length;
    const image = images[current];
    media.replaceChildren(createVisual(site, image, current, false));
    media.scrollLeft = 0;
    media.scrollTop = 0;
    frame.setAttribute("aria-label", shotLabel(site, image, current));
  }

  previous.addEventListener("click", () => select(current - 1));
  next.addEventListener("click", () => select(current + 1));

  frame.addEventListener("click", (event) => {
    if (event.target.closest(".shot-nav, video")) return;
    const img = media.querySelector("img[src]");
    if (!img) return;
    openViewer(images, current, select, frame);
  });

  frame.addEventListener("keydown", (event) => {
    if (isViewerOpen()) return;
    if (event.target.closest("video, iframe")) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    select(current + (event.key === "ArrowRight" ? 1 : -1));
  });

  if (images.length < 2) {
    previous.hidden = true;
    next.hidden = true;
  }

  select(0);
  frame.append(media, previous, next);
  gallery.append(frame);
  return gallery;
}

function shotNav(label, direction) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `shot-nav ${direction}`;
  button.setAttribute("aria-label", label);
  button.textContent = direction === "prev" ? "‹" : "›";
  return button;
}

const assetVersion = Date.now();

function freshSrc(src) {
  if (!src || /^(https?:)?\/\//i.test(src)) return src;
  const joiner = src.includes("?") ? "&" : "?";
  return `${src}${joiner}v=${assetVersion}`;
}

function shotLabel(site, image, index) {
  if (image && image.alt) return image.alt;
  return `${site.name || "Project"} screenshot ${index + 1}`;
}

function createVisual(site, image, index, compact) {
  const label = shotLabel(site, image, index);
  const src = image && image.src ? String(image.src) : "";

  if (src && isVideo(src)) {
    return createVideo(image, src, label, compact);
  }

  const youtube = youtubeId(src);
  if (youtube) return createYouTube(youtube, label);

  if (src) {
    const img = document.createElement("img");
    img.src = freshSrc(src);
    img.alt = compact ? "" : label;
    img.draggable = false;
    img.addEventListener("error", () => {
      img.replaceWith(createPlaceholder(label, index, compact));
    });
    return img;
  }

  return createPlaceholder(label, index, compact);
}

function isVideo(src) {
  return /\.(mp4|webm)$/i.test(src);
}

function youtubeId(src) {
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        id = url.pathname.split("/")[2] || "";
      } else {
        id = url.searchParams.get("v") || "";
      }
    }
    return /^[\w-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function createYouTube(id, label) {
  const frame = document.createElement("iframe");
  frame.className = "youtube";
  frame.src = `https://www.youtube-nocookie.com/embed/${id}`;
  frame.title = label;
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  return frame;
}

function createVideo(image, src, label, compact) {
  if (compact && image.poster) {
    const poster = document.createElement("img");
    poster.src = image.poster;
    poster.alt = "";
    return poster;
  }

  const video = document.createElement("video");
  video.src = src;
  video.controls = !compact;
  video.playsInline = true;
  video.preload = compact ? "none" : "metadata";
  if (image.poster) video.poster = image.poster;
  if (compact) {
    video.muted = true;
    video.tabIndex = -1;
  } else {
    video.setAttribute("aria-label", label);
  }
  video.addEventListener("error", () => {
    video.replaceWith(createPlaceholder(label, 0, compact));
  });
  return videoFrame(video);
}

function createPlaceholder(label, index, compact) {
  const placeholder = document.createElement("div");
  placeholder.className = "placeholder";
  if (compact) {
    placeholder.setAttribute("aria-hidden", "true");
  } else {
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", label);
  }
  const caption = document.createElement("span");
  caption.textContent = `Screenshot ${index + 1}`;
  placeholder.append(caption);
  return placeholder;
}

let viewer;
let viewerState;

function ensureViewer() {
  if (viewer) return viewer;
  viewer = document.createElement("div");
  viewer.className = "viewer";
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", "Image viewer");
  viewer.setAttribute("aria-hidden", "true");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "viewer-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";

  const previous = shotNav("Previous image", "prev");
  const next = shotNav("Next image", "next");
  const stage = document.createElement("div");
  stage.className = "viewer-stage";

  close.addEventListener("click", (event) => {
    event.stopPropagation();
    closeViewer();
  });
  previous.addEventListener("click", (event) => {
    event.stopPropagation();
    stepViewer(-1);
  });
  next.addEventListener("click", (event) => {
    event.stopPropagation();
    stepViewer(1);
  });
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });

  viewer.append(close, previous, next, stage);
  document.body.append(viewer);
  return viewer;
}

function openViewer(images, index, onChange, opener) {
  ensureViewer();
  viewerState = { images, index, onChange, opener };
  renderViewer();
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewer-open");
  viewer.querySelector(".viewer-close").focus();
}

function closeViewer() {
  if (!viewer || !viewerState) return;
  const opener = viewerState.opener;
  viewer.classList.remove("is-open");
  viewer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("viewer-open");
  viewer.querySelector(".viewer-stage").replaceChildren();
  viewerState = null;
  if (opener) opener.focus();
}

function isViewerOpen() {
  return Boolean(viewerState);
}

function stepViewer(delta) {
  if (!viewerState || viewerState.images.length < 2) return;
  const count = viewerState.images.length;
  viewerState.index = (viewerState.index + delta + count) % count;
  viewerState.onChange(viewerState.index);
  renderViewer();
}

function renderViewer() {
  const stage = viewer.querySelector(".viewer-stage");
  const image = viewerState.images[viewerState.index];
  const label = image && image.alt ? image.alt : `Image ${viewerState.index + 1}`;
  const src = image && image.src ? String(image.src) : "";
  stage.replaceChildren(viewerVisual(src, label, image));
  stage.scrollLeft = 0;
  stage.scrollTop = 0;
  const multiple = viewerState.images.length > 1;
  viewer.querySelector(".shot-nav.prev").hidden = !multiple;
  viewer.querySelector(".shot-nav.next").hidden = !multiple;
}

function videoFrame(video) {
  const frame = document.createElement("div");
  frame.className = "shot-video";
  const play = document.createElement("span");
  play.className = "shot-play";
  play.setAttribute("aria-hidden", "true");
  const sync = () => frame.classList.toggle("is-playing", !video.paused && !video.ended);
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  video.addEventListener("ended", sync);
  frame.append(video, play);
  return frame;
}

function viewerVisual(src, label, image) {
  if (src && isVideo(src)) {
    const video = document.createElement("video");
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.autoplay = false;
    if (image && image.poster) video.poster = image.poster;
    video.setAttribute("aria-label", label);
    return videoFrame(video);
  }
  const img = document.createElement("img");
  img.src = freshSrc(src);
  img.alt = label;
  img.draggable = false;
  return img;
}

document.addEventListener("keydown", (event) => {
  if (!isViewerOpen()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeViewer();
    return;
  }
  if (event.target.closest && event.target.closest("video, iframe")) return;
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  event.stopPropagation();
  stepViewer(event.key === "ArrowRight" ? 1 : -1);
}, true);
