import { useEffect, useState } from "react";
import { fetchNewsArticles, type NewsArticle } from "../api";

interface Props {
  stormName: string;
  onNavigateToCommand: () => void;
  onPrint: () => void;
}

export default function BulletinsPage({stormName, onNavigateToCommand, onPrint}: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [status, setStatus] = useState("Loading bulletins…");
  const [filter, setFilter] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("Loading bulletins…");
    setArticles([]);
    fetchNewsArticles().then(items => {
      if (!active) return;
      setArticles(items);
      setStatus(items.length ? "" : "No sourced articles are available.");
    }).catch(() => { if (active) setStatus("Bulletins are unavailable. Retry to reconnect."); });
    return () => { active = false; };
  }, [refresh]);
  const visible = articles.filter(item => (item.title + " " + item.cyclone_tag).toLowerCase().includes(filter.toLowerCase()));
  return <main className="op-showcase-root"><div className="op-showcase-container">
    <h1 className="op-section-title">Bulletins and scenario reports</h1>
    <p className="op-section-desc">Headlines from configured news sources. Check the original publication for its issue time, area and issuing authority.</p>
    <div className="op-technical-panel">
      <h2>Scenario screening report</h2><p>{stormName}</p>
      <div className="op-hero-cta-group"><button className="op-btn-primary" onClick={onPrint}>Print screening report</button>
      <button className="op-btn-secondary" onClick={onNavigateToCommand}>Open tactical map</button></div>
    </div>
    <section className="op-showcase-section"><h2>Source articles</h2>
      <div className="op-hero-cta-group"><input aria-label="Filter bulletins" placeholder="Filter by headline or cyclone" value={filter} onChange={e => setFilter(e.target.value)} />
      <button className="op-btn-secondary" onClick={() => setRefresh(value => value + 1)}>Refresh articles</button></div>
      <p role="status">{status || (!visible.length ? "No articles match this filter." : "")}</p>
      {visible.map(a => <article className="op-technical-panel" key={a.id}>
        <h3><a href={a.url} target="_blank" rel="noreferrer">{a.title}</a></h3>
        <p>{a.source_name} {a.published_at}</p><p>{a.snippet}</p>
      </article>)}
    </section>
  </div></main>;
}
