import React, { useState, useEffect } from "react";
import {
  fetchNewsArticles,
  fetchNewsSources,
  addNewsSource,
  deleteNewsSource,
  triggerNewsScrape,
  type NewsArticle,
  type NewsSource,
  type RealtimeWeather,
} from "./api";

interface NewsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  realtimeWeather: RealtimeWeather | null;
  activeCycloneTag?: string;
}

export default function NewsPanel({
  isOpen,
  onClose,
  realtimeWeather,
  activeCycloneTag,
}: NewsPanelProps) {
  const [activeTab, setActiveTab] = useState<"articles" | "admin">("articles");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Admin form state
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newScrapeType, setNewScrapeType] = useState("html");

  useEffect(() => {
    if (isOpen) {
      loadArticles();
      loadSources();
    }
  }, [isOpen, selectedTag]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await fetchNewsArticles(searchQuery, selectedTag);
      setArticles(data);
    } catch (err) {
      console.error("Failed to load articles:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSources = async () => {
    try {
      const data = await fetchNewsSources();
      setSources(data);
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadArticles();
  };

  const handleScrapeNow = async () => {
    setScraping(true);
    setStatusMsg("Scraping configured news websites...");
    try {
      const res = await triggerNewsScrape();
      setStatusMsg(`Scraped ${res.total_scraped_articles} new cyclone articles!`);
      await loadArticles();
      await loadSources();
    } catch (err) {
      setStatusMsg("Scrape failed. Check website permissions.");
    } finally {
      setScraping(false);
      setTimeout(() => setStatusMsg(""), 4000);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    setLoading(true);
    setStatusMsg("Adding source & scraping news...");
    try {
      await addNewsSource(newSourceName, newSourceUrl, newScrapeType);
      setNewSourceName("");
      setNewSourceUrl("");
      setStatusMsg("News website source added successfully!");
      await loadSources();
      await loadArticles();
    } catch (err: any) {
      setStatusMsg(err.message || "Failed to add news source");
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(""), 4000);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Are you sure you want to remove this news website source?")) return;
    try {
      await deleteNewsSource(id);
      await loadSources();
      await loadArticles();
    } catch (err) {
      console.error("Failed to delete source:", err);
    }
  };

  if (!isOpen) return null;

  const getImpactBadgeClass = (impact: string) => {
    switch (impact) {
      case "CRITICAL":
        return "bg-red-600 text-white font-bold animate-pulse";
      case "SEVERE":
        return "bg-orange-500 text-white font-bold";
      case "HIGH":
        return "bg-amber-500 text-black font-semibold";
      default:
        return "bg-sky-600 text-white";
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[540px] bg-slate-950/95 backdrop-blur-md border-l border-cyan-500/30 text-white shadow-2xl z-50 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 bg-slate-900/90 border-b border-cyan-500/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-xl font-bold text-cyan-400 tracking-wide flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              CYCLONE NEWS & INTELLIGENCE
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Real-time Weather Ticker */}
        {realtimeWeather && (
          <div className="bg-slate-800/80 rounded-lg p-2.5 text-xs flex items-center justify-between border border-cyan-500/20">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-emerald-400">REALTIME FEED:</span>
              <span className="text-slate-300">{realtimeWeather.status}</span>
            </div>
            <div className="flex gap-3 text-cyan-300 font-mono">
              <span>💨 {realtimeWeather.wind_speed_kph} km/h</span>
              <span>📉 {realtimeWeather.surface_pressure_hpa} hPa</span>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab("articles")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition ${
              activeTab === "articles"
                ? "bg-cyan-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            📰 Live Cyclone News ({articles.length})
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition ${
              activeTab === "admin"
                ? "bg-cyan-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            ⚙️ Admin News Sources ({sources.length})
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {statusMsg && (
          <div className="p-3 bg-cyan-950/80 border border-cyan-400/50 rounded-lg text-xs text-cyan-200 font-medium">
            {statusMsg}
          </div>
        )}

        {activeTab === "articles" && (
          <>
            {/* Search & Action bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Search headlines or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 rounded-lg border border-cyan-500/30"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleScrapeNow}
                disabled={scraping}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-slate-950 rounded-lg flex items-center gap-1 shadow"
              >
                {scraping ? "Scraping..." : "🔄 Scrape Fresh News"}
              </button>
            </form>

            {/* Tag Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pb-1 border-b border-slate-800">
              {["ALL", "Bay of Bengal", "Odisha / WB Coast", "Paradeep Port", "Climate / Ocean Energy"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${
                    selectedTag === tag
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* News Article List */}
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Loading cyclone news articles...
              </div>
            ) : articles.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-slate-900/50 rounded-xl border border-slate-800 p-6">
                <p>No news articles found for this filter.</p>
                <button
                  onClick={handleScrapeNow}
                  className="mt-3 px-4 py-2 bg-cyan-600 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Scrape News Websites Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {articles.map((art) => (
                  <div
                    key={art.id}
                    className="p-3.5 bg-slate-900/80 hover:bg-slate-850 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition group flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                        {art.source_name}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getImpactBadgeClass(
                          art.impact_level
                        )}`}
                      >
                        {art.impact_level}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition leading-snug">
                      {art.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {art.snippet}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/80">
                      <span>🏷️ {art.cyclone_tag}</span>
                      <a
                        href={art.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        Read Article →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "admin" && (
          <div className="space-y-5">
            {/* Add Source Form */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-cyan-500/30 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                ➕ Add New News Website Source
              </h3>
              <p className="text-[11px] text-slate-400">
                Grant permission to scrape cyclone & weather news from custom websites or RSS feeds.
              </p>

              <form onSubmit={handleAddSource} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-300 uppercase mb-1">
                    Website / Publisher Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kolkata Telegraph Cyclone Watch"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-300 uppercase mb-1">
                    News Website URL / RSS Feed
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://news-website.com/cyclone"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-slate-300 uppercase mb-1">
                      Scrape Type
                    </label>
                    <select
                      value={newScrapeType}
                      onChange={(e) => setNewScrapeType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                    >
                      <option value="html">Web Page HTML Scraper</option>
                      <option value="rss">RSS / Atom XML Feed</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-slate-950 text-xs rounded-lg shadow transition"
                >
                  {loading ? "Adding & Scraping..." : "✅ Grant Access & Start Scraping"}
                </button>
              </form>
            </div>

            {/* Configured Sources List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Active Configured News Websites ({sources.length})
              </h3>

              <div className="space-y-2">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-200 truncate">
                        {src.name}
                      </span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 truncate hover:underline"
                      >
                        {src.url}
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {src.scrape_type.toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleDeleteSource(src.id)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded transition"
                        title="Remove news source"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
