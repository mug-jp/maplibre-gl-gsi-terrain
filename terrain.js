var c = Object.defineProperty;
var g = (t, e, r) => e in t ? c(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var i = (t, e, r) => (g(t, typeof e != "symbol" ? e + "" : e, r), r);
const h = async (t, e) => {
  let r;
  try {
    r = await fetch(t, { signal: e });
  } catch (s) {
    return e.aborted || console.error(`Failed to fetch image: ${s}`), null;
  }
  return r.ok ? await createImageBitmap(await r.blob()) : null;
};
class m {
  constructor(e) {
    i(this, "worker");
    i(this, "pendingRequests");
    i(this, "handleMessage", (e) => {
      const { url: r, buffer: s, error: n } = e.data;
      if (n)
        console.error(`Error processing tile ${r}:`, n);
      else {
        const o = this.pendingRequests.get(r);
        o && (o.resolve({ data: new Uint8Array(s) }), this.pendingRequests.delete(r));
      }
    });
    i(this, "handleError", (e) => {
      console.error("Worker error:", e), this.pendingRequests.forEach((r) => {
        r.reject(new Error("Worker error occurred"));
      }), this.pendingRequests.clear();
    });
    this.worker = e, this.pendingRequests = /* @__PURE__ */ new Map(), this.worker.addEventListener("message", this.handleMessage), this.worker.addEventListener("error", this.handleError);
  }
  async request(e, r) {
    const s = await h(e, r.signal);
    return s ? new Promise((n, o) => {
      this.pendingRequests.set(e, { resolve: n, reject: o, controller: r }), this.worker.postMessage({ image: s, url: e }), r.signal.onabort = () => {
        this.pendingRequests.delete(e), o(new Error("Request aborted"));
      };
    }) : Promise.reject(new Error("Failed to load image"));
  }
}
const p = new Worker(new URL("" + new URL("assets/worker.2eeb969e.js", import.meta.url).href, self.location), {
  type: "module"
}), w = new m(p), k = (t, e = {}) => {
  var s, n, o, a;
  return t("gsidem", (l, u) => {
    const d = l.url.replace("gsidem://", "");
    return w.request(d, u);
  }), {
    type: "raster-dem",
    tiles: [`gsidem://${(s = e.tileUrl) != null ? s : "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png"}`],
    tileSize: 256,
    minzoom: (n = e.minzoom) != null ? n : 1,
    maxzoom: (o = e.maxzoom) != null ? o : 14,
    attribution: (a = e.attribution) != null ? a : '<a href="https://maps.gsi.go.jp/development/ichiran.html">\u5730\u7406\u9662\u30BF\u30A4\u30EB</a>'
  };
};
export {
  k as useGsiTerrainSource
};
