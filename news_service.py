"""News Service for CYCLONEX.

Handles scraping cyclone-related news from user/admin configured news websites,
RSS feeds, and disaster bulletins, storing articles, and classifying impact.
"""

from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any
import requests

from storage import get_connection

DEFAULT_NEWS_SOURCES = [
    {"id": "src_gdacs_rss", "name": "GDACS Global Disaster Alerts", "url": "https://www.gdacs.org/xml/rss.xml", "scrape_type": "rss", "active": 1},
    {"id": "src_bbc_rss", "name": "BBC Science & Environment", "url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "scrape_type": "rss", "active": 1},
    {"id": "src_imd_rsmc", "name": "IMD RSMC Tropical Cyclone Bulletins", "url": "https://rsmcnewdelhi.imd.gov.in/", "scrape_type": "html", "active": 1},
]


def init_news_tables() -> None:
    """Create news sources and articles tables if not existing."""
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS news_sources (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                scrape_type TEXT NOT NULL DEFAULT 'html',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS news_articles (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                source_name TEXT NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                snippet TEXT,
                published_at TEXT NOT NULL,
                impact_level TEXT NOT NULL DEFAULT 'MODERATE',
                cyclone_tag TEXT NOT NULL DEFAULT 'General Cyclone',
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES news_sources (id) ON DELETE CASCADE
            );
            """
        )
        conn.commit()

        conn.execute("CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY)")
        if not conn.execute("SELECT 1 FROM app_migrations WHERE name='news_sources_v2'").fetchone():
            now = datetime.now(timezone.utc).isoformat()
            # Migrate once, so removing a default feed remains effective.
            conn.execute("UPDATE news_sources SET active=0 WHERE id IN ('src_imd_bulletin','src_reliefweb','src_ndtv_weather','src_bbc_weather')")
            for src in DEFAULT_NEWS_SOURCES:
                conn.execute("INSERT OR IGNORE INTO news_sources (id,name,url,scrape_type,active,created_at) VALUES (?,?,?,?,?,?)",
                             (src["id"], src["name"], src["url"], src["scrape_type"], src["active"], now))
            conn.execute("INSERT INTO app_migrations(name) VALUES ('news_sources_v2')")
        conn.commit()


def get_news_sources() -> list[dict[str, Any]]:
    """Fetch all configured news sources."""
    init_news_tables()
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, name, url, scrape_type, active, created_at FROM news_sources ORDER BY created_at DESC;"
        )
        return [dict(row) for row in cursor.fetchall()]


def add_news_source(name: str, url: str, scrape_type: str = "html") -> dict[str, Any]:
    """Add a new custom news website/feed source URL."""
    init_news_tables()
    source_id = f"src_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    created_at = datetime.now(timezone.utc).isoformat()
    
    # Clean URL format
    if not url.startswith(("http://", "https://")):
        url = "https://" + url.strip()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO news_sources (id, name, url, scrape_type, active, created_at)
            VALUES (?, ?, ?, ?, 1, ?);
            """,
            (source_id, name.strip(), url.strip(), scrape_type.lower(), created_at),
        )
        conn.commit()

    # Trigger immediate scrape for newly added source
    try:
        scrape_source(source_id, name.strip(), url.strip(), scrape_type.lower())
    except Exception as err:
        print(f"Initial scrape for new source {name} had warning: {err}")

    return {
        "id": source_id,
        "name": name,
        "url": url,
        "scrape_type": scrape_type,
        "active": 1,
        "created_at": created_at,
    }


def delete_news_source(source_id: str) -> bool:
    """Delete a news source and its scraped articles."""
    init_news_tables()
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM news_sources WHERE id = ?;", (source_id,))
        conn.execute("DELETE FROM news_articles WHERE source_id = ?;", (source_id,))
        conn.commit()
        return cursor.rowcount > 0


def toggle_news_source(source_id: str, active: int) -> bool:
    """Toggle news source active status."""
    init_news_tables()
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE news_sources SET active = ? WHERE id = ?;", (active, source_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def get_news_articles(
    query: str | None = None, cyclone_tag: str | None = None, limit: int = 50
) -> list[dict[str, Any]]:
    """Retrieve news articles with optional keyword and cyclone tag filtering."""
    init_news_tables()
    with get_connection() as conn:
        sql = "SELECT id, source_id, source_name, title, url, snippet, published_at, impact_level, cyclone_tag, scraped_at FROM news_articles"
        params: list[Any] = []
        conditions: list[str] = ["id NOT IN ('art_01','art_02','art_03','art_04','art_05')", "title NOT LIKE 'Latest Advisory Update from %'"]

        if query:
            conditions.append("(title LIKE ? OR snippet LIKE ? OR cyclone_tag LIKE ?)")
            q = f"%{query}%"
            params.extend([q, q, q])

        if cyclone_tag and cyclone_tag != "ALL":
            conditions.append("cyclone_tag LIKE ?")
            params.append(f"%{cyclone_tag}%")

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        sql += " ORDER BY published_at DESC LIMIT ?;"
        params.append(limit)

        cursor = conn.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]


def classify_article_impact(text: str) -> tuple[str, str]:
    """Classify risk/impact level and extract cyclone keyword tags from news text."""
    lower = text.lower()
    
    impact = "MODERATE"
    if any(k in lower for k in ["red alert", "super cyclone", "extreme", "devastating", "catastrophic", "evacuate immediately"]):
        impact = "CRITICAL"
    elif any(k in lower for k in ["severe", "landfall", "warning 10", "violent wind", "storm surge", "heavy damage"]):
        impact = "SEVERE"
    elif any(k in lower for k in ["gale", "high waves", "advisory", "ndrf", "shelter"]):
        impact = "HIGH"

    tag = "General Cyclone"
    for cyclone_name in ["amphan", "fani", "hudhud", "bulbul", "nisarga", "remal", "biparjoy", "asani", "dana", "yaas", "gulab", "mandous"]:
        if cyclone_name in lower:
            tag = f"Cyclone {cyclone_name.capitalize()}"
            break
    if tag == "General Cyclone":
        if "bay of bengal" in lower:
            tag = "Bay of Bengal"
        elif "arabian sea" in lower:
            tag = "Arabian Sea"
        elif "odisha" in lower or "digha" in lower or "bengal" in lower:
            tag = "East Coast India"

    return impact, tag


_SCRAPE_RESULTS: dict[str, dict] = {}


def scrape_source(source_id: str, source_name: str, url: str, scrape_type: str) -> int:
    """Persist only source-provided headlines. Never invent a bulletin."""
    from hashlib import sha256
    from urllib.parse import urljoin, urlparse
    from email.utils import parsedate_to_datetime
    from html.parser import HTMLParser

    now = datetime.now(timezone.utc).isoformat()
    articles = []
    try:
        resp = requests.get(url, headers={"User-Agent": "CYCLONEX/2.2 (research news reader)"}, timeout=(3, 8))
        resp.raise_for_status()
        content = resp.text
        is_xml = scrape_type == "rss" or "xml" in resp.headers.get("Content-Type", "")
        def relevant(title, snippet=""):
            return any(word in (title + " " + snippet).lower() for word in ("cyclone", "storm", "flood", "landfall", "hurricane", "typhoon", "heavy rain", "tropical depression"))
        def add(title, link, snippet, published=""):
            title = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
            link = urljoin(url, link)
            if not title or urlparse(link).scheme not in ("http", "https") or not relevant(title, snippet):
                return
            impact, tag = classify_article_impact(title + " " + snippet)
            art_id = "live_" + sha256(link.encode()).hexdigest()[:24]
            articles.append((art_id, source_id, source_name, title[:250], link, html.unescape(re.sub(r"<[^>]+>", "", snippet))[:500], published, impact, tag, now))
        if is_xml:
            root = ET.fromstring(content)
            for item in root.findall(".//item") + root.findall(".//{http://www.w3.org/2005/Atom}entry"):
                def child(name, atom=None):
                    elem = item.find(name)
                    if elem is None:
                        elem = item.find("{http://www.w3.org/2005/Atom}" + (atom or name))
                    return elem
                def value(elem):
                    return "".join(elem.itertext()).strip() if elem is not None else ""
                link = child("link")
                published = value(child("pubDate", "published")) or value(child("updated"))
                if published:
                    try:
                        published = parsedate_to_datetime(published).isoformat()
                    except (ValueError, TypeError):
                        try:
                            published = datetime.fromisoformat(published.replace("Z", "+00:00")).isoformat()
                        except ValueError:
                            published = ""
                add(value(child("title")), link.get("href", "") or value(link) if link is not None else url,
                    value(child("description", "summary")), published)
        else:
            class Links(HTMLParser):
                def __init__(self):
                    super().__init__(); self.href = None; self.text = []
                def handle_starttag(self, tag, attrs):
                    if tag == "a":
                        self.href = dict(attrs).get("href"); self.text = []
                def handle_data(self, data):
                    if self.href is not None:
                        self.text.append(data)
                def handle_endtag(self, tag):
                    if tag == "a" and self.href is not None:
                        title = " ".join(self.text)
                        if len(title) > 25:
                            add(title, self.href, "")
                        self.href = None
            Links().feed(content)
        with get_connection() as conn:
            for article in articles[:50]:
                conn.execute("INSERT OR REPLACE INTO news_articles (id,source_id,source_name,title,url,snippet,published_at,impact_level,cyclone_tag,scraped_at) VALUES (?,?,?,?,?,?,?,?,?,?)", article)
            conn.commit()
        _SCRAPE_RESULTS[source_id] = {"status": "OK" if articles else "NO_RELEVANT_ARTICLES", "scraped_articles": len(articles[:50])}
        return len(articles[:50])
    except (requests.RequestException, ET.ParseError, ValueError) as exc:
        _SCRAPE_RESULTS[source_id] = {"status": "UNAVAILABLE", "scraped_articles": 0, "error": type(exc).__name__}
        return 0


def scrape_all_active_sources() -> dict[str, Any]:
    from concurrent.futures import ThreadPoolExecutor
    sources = [s for s in get_news_sources() if s.get("active")]
    def run(src):
        scrape_source(src["id"], src["name"], src["url"], src.get("scrape_type", "html"))
        return {"source": src["name"], **_SCRAPE_RESULTS[src["id"]]}
    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(run, sources))
    total = sum(item["scraped_articles"] for item in results)
    return {"status": "success" if total else "no_new_articles" if any(r["status"] != "UNAVAILABLE" for r in results) else "unavailable",
            "total_scraped_articles": total, "source_breakdown": results, "scraped_at": datetime.now(timezone.utc).isoformat()}
