// Runtime config for the extension. Keep small and dependency-free.
export const CONFIG = {
  backendUrl: "https://medullo-cognitive-companion-production.up.railway.app",
  frontendUrl: "https://medullo-cognitive-companion.vercel.app",
  flushIntervalSeconds: 15,
  flushBatchMax: 50,
  idleThresholdSeconds: 60,
};

export const SEARCH_HOSTS = {
  "www.google.com": "q",
  "google.com": "q",
  "www.bing.com": "q",
  "duckduckgo.com": "q",
  "www.duckduckgo.com": "q",
  "search.brave.com": "q",
  "www.youtube.com": "search_query",
  "github.com": "q",
  "stackoverflow.com": "q",
};
