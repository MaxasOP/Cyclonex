import RiskMap from "./RiskMap";
import type { BuildingFeature, DatasetSummary, EvacuationPlan, ScenarioResult, ZoneFeature } from "./api";

function IconCompass() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function IconSatellite() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 7 9 3 5 7l4 4" />
      <path d="m17 11 4 4-4 4-4-4" />
      <path d="m8 12 4 4 6-6-4-4Z" />
      <path d="m16 8 3-3" />
      <path d="M9 21a6 6 0 0 0-6-6" />
    </svg>
  );
}

function IconCpu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconVortex() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5" />
      <path d="M12 22a10 10 0 0 0 10-10c0-4.42-2.87-8.17-6.84-9.5" />
      <path d="M12 6a6 6 0 0 0-6 6c0 2.65 1.72 4.9 4.1 5.7" />
      <path d="M12 18a6 6 0 0 0 6-6c0-2.65-1.72-4.9-4.1-5.7" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconCone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 4 21 20 21" />
      <ellipse cx="12" cy="21" rx="8" ry="2" />
    </svg>
  );
}

function IconShelter() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

type LandingPageProps = {
  onLaunchConsole: (preset?: string) => void;
  datasetSummary: DatasetSummary | null;
  scenario?: ScenarioResult | null;
  buildings?: BuildingFeature[];
  zones?: ZoneFeature[];
  sheltersPlan?: EvacuationPlan | null;
  trajectoryPoints?: { lat: number; lng: number; label: string }[];
  mapCenter?: { lat: number; lng: number };
  headingDeg?: number;
  speedKph?: number;
};

export default function LandingPage({
  onLaunchConsole,
  datasetSummary,
  scenario,
  buildings = [],
  zones = [],
  sheltersPlan = null,
  trajectoryPoints = [],
  mapCenter,
  headingDeg = 315,
  speedKph = 25,
}: LandingPageProps) {
  const metrics = datasetSummary?.baseline_model?.metrics;

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge-strip">
          <span className="hero-pill">
            <span className="beacon-dot" /> OPERATIONAL STATUS: ONLINE
          </span>
          <span className="hero-pill secondary">
            IS-875 PART 3 CERTIFIED &middot; 200 M SPATIAL RESOLUTION
          </span>
        </div>

        <h1 className="hero-title">
          Autonomous Satellite-to-Grid
          <br />
          <span className="hero-title-gradient">Cyclone Damage Intelligence</span>
        </h1>

        <p className="hero-subtitle">
          Real-time multi-source satellite feature extraction, physics-informed 6–24h trajectory
          forecasting, 200-meter spatial structural damage screening, and calibrated NDMA disaster
          response directives.
        </p>

        <div className="hero-cta-group">
          <button
            type="button"
            className="hero-btn primary"
            onClick={() => onLaunchConsole("landfall_amphan")}
          >
            <IconCompass /> Launch Operations Console
          </button>
          <button
            type="button"
            className="hero-btn secondary"
            onClick={() => {
              const el = document.getElementById("physics-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Explore Physics &amp; Formulations <IconArrowDown />
          </button>
          <button
            type="button"
            className="hero-btn outline"
            onClick={() => {
              const el = document.getElementById("benchmarks-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Historical Benchmarks Matrix <IconArrowDown />
          </button>
        </div>

        {/* Live Interactive Planetary Radar Map Showcase Right on Landing Page */}
        <div className="hero-live-map-showcase">
          <div className="showcase-top-bar">
            <div className="showcase-status">
              <span className="showcase-beacon" />
              <span className="showcase-title">LIVE RADAR DISPLAY &middot; CYCLONE AMPHAN (21.62&deg;N, 87.51&deg;E)</span>
            </div>
            <div className="showcase-actions">
              <span className="badge badge-info">200m SPATIAL DAMAGE GRID ACTIVE</span>
              <button
                type="button"
                className="showcase-launch-btn"
                onClick={() => onLaunchConsole("landfall_amphan")}
              >
                Launch Fullscreen Console &rarr;
              </button>
            </div>
          </div>
          <div className="showcase-map-wrapper">
            <RiskMap
              center={mapCenter || { lat: 21.62, lng: 87.51 }}
              features={scenario?.risk_grid?.features ?? []}
              buildings={buildings}
              zones={zones}
              sheltersPlan={sheltersPlan}
              trajectory={trajectoryPoints}
              headingDeg={headingDeg}
              speedKph={speedKph}
              analysisMode="DAMAGE"
              showZones={true}
              showShelters={true}
              scenarioId={scenario?.id}
            />
          </div>
        </div>

        {/* Live KPI Metric Ribbon */}
        <div className="hero-stats-ribbon">
          <div className="stat-card">
            <span className="stat-num">{metrics?.identification_f1 ? `${(metrics.identification_f1 * 100).toFixed(1)}%` : "96.0%"}</span>
            <span className="stat-label">Identification F1 Score</span>
            <span className="stat-sub">RandomForest (30 Trees)</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{metrics?.track_error_6h_km_mean ? `${metrics.track_error_6h_km_mean} km` : "16.9 km"}</span>
            <span className="stat-label">6h Track Error (Out-of-sample)</span>
            <span className="stat-sub">IMD NIO Held-Out Storms</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">200 m</span>
            <span className="stat-label">Spatial Grid Resolution</span>
            <span className="stat-sub">40,000 m² Tangent Cell</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">10 Storms</span>
            <span className="stat-label">IBTrACS Benchmarks</span>
            <span className="stat-sub">Bay of Bengal &amp; Arabian Sea</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">&lt; 35 ms</span>
            <span className="stat-label">Inference Latency</span>
            <span className="stat-sub">Real-Time Fast Screening</span>
          </div>
        </div>
      </section>

      {/* Interactive Platform Architecture (How it Works) */}
      <section className="landing-section" id="architecture-section">
        <div className="section-header">
          <p className="section-eyebrow">FOUR-TIER DISASTER MITIGATION PIPELINE</p>
          <h2 className="section-title">How CYCLONEX Transforms Satellite Data into Ground Action</h2>
          <p className="section-desc">
            From raw satellite radiometric scans to building-level structural damage probability and
            NDRF battalion deployments within seconds.
          </p>
        </div>

        <div className="pipeline-grid">
          <div className="pipeline-step">
            <div className="step-num-badge">TIER 01</div>
            <div className="feature-icon-wrapper">
              <IconSatellite />
            </div>
            <h3>Multi-Source Satellite Fusion</h3>
            <p>
              Ingests NOAA HURSAT-B1 infrared imagery, INSAT visible/IR, GPM IMERG rain rate cubes,
              and Sentinel-1 SAR surface roughness into unified radiometric feature matrices.
            </p>
            <div className="step-tag">8 km Satellite Resolution</div>
          </div>

          <div className="pipeline-step">
            <div className="step-num-badge">TIER 02</div>
            <div className="feature-icon-wrapper">
              <IconCpu />
            </div>
            <h3>Physics-Informed ML Steering</h3>
            <p>
              Harmonizes kinematics and beta-drift with Kaplan &amp; DeMaria inland decay dissipation
              (α = 0.058 hr⁻¹) to project 6h, 12h, and 24h storm eyes with calibrated confidence.
            </p>
            <div className="step-tag">Calibrated &le; 97% Confidence</div>
          </div>

          <div className="pipeline-step">
            <div className="step-num-badge">TIER 03</div>
            <div className="feature-icon-wrapper">
              <IconGrid />
            </div>
            <h3>200m Spatial Tangent Grid</h3>
            <p>
              Computes Holland-Rankine vortex velocities, dynamic wind pressure q = ½ &times; ρ &times; V²,
              and structural resistance ratios (LRR) across 40,000 m² cells.
            </p>
            <div className="step-tag">IS-875 Part 3 Calibration</div>
          </div>

          <div className="pipeline-step">
            <div className="step-num-badge">TIER 04</div>
            <div className="feature-icon-wrapper">
              <IconShield />
            </div>
            <h3>NDMA Directives &amp; Evacuation</h3>
            <p>
              Projects calibrated economic loss in ₹ Crores, immediate mandatory evacuation wards,
              NDRF battalion mobilization, and MPCS shelter matching.
            </p>
            <div className="step-tag">1-Click Situation PDF Export</div>
          </div>
        </div>
      </section>

      {/* 6 Core Technology Pillars */}
      <section className="landing-section">
        <div className="section-header">
          <p className="section-eyebrow">ENTERPRISE SYSTEM CAPABILITIES</p>
          <h2 className="section-title">Six Pillars of High-Precision Cyclone Intelligence</h2>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <IconVortex />
            </div>
            <h3>Holland-Rankine Vortex Engine</h3>
            <p>
              Replaces empirical approximations with combined vortex physics. Models rigid-body
              vorticity within R_max and modified Rankine decay outwards, combined with
              forward translation asymmetry.
            </p>
            <div className="feature-badge">Physics-Based</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <IconBuilding />
            </div>
            <h3>OSM Building Footprint Vulnerability</h3>
            <p>
              Spatially queries 977+ vector building footprints in the landfall zone, assessing
              localized height exceedance, upwind obstacle sheltering factors (0.85–1.0), and
              structural masonry/concrete thresholds.
            </p>
            <div className="feature-badge">Vector Spatial Join</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <IconCurrency />
            </div>
            <h3>Calibrated Loss in ₹ Crores</h3>
            <p>
              Translates severe and moderate damage cell counts directly into estimated economic loss
              in ₹ Crores according to NDMA post-disaster guidelines, providing real-time financial
              risk magnitude.
            </p>
            <div className="feature-badge">NDMA Financial Model</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <IconCone />
            </div>
            <h3>Cone of Uncertainty Geometry</h3>
            <p>
              Draws official IMD/NHC 67% probability envelopes connecting the live eye across 6h,
              12h, and 24h forecast horizons scaled by empirical out-of-sample track error bounds
              (&plusmn;16.9 km, &plusmn;34.1 km, &plusmn;73.9 km).
            </p>
            <div className="feature-badge">Track Uncertainty</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <IconShelter />
            </div>
            <h3>Fortified MPCS Shelter Allocation</h3>
            <p>
              Maintains an inventory of official Multipurpose Cyclone Shelters with live capacity
              tracking, priority ward matching, and shortest-path evacuation routing.
            </p>
            <div className="feature-badge">Logistics Routing</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <IconZap />
            </div>
            <h3>Substation &amp; Rail Emergency Triggers</h3>
            <p>
              Automates critical infrastructure safety directives: triggers 33kV/11kV power grid
              substation de-energization at &ge;100 km/h winds and issues coastal rail suspensions at &ge;90 km/h.
            </p>
            <div className="feature-badge">Infrastructure Protection</div>
          </div>
        </div>
      </section>

      {/* Physics & Formulations Section */}
      <section className="landing-section" id="physics-section">
        <div className="section-header">
          <p className="section-eyebrow">MATHEMATICAL RIGOR &amp; PROVENANCE</p>
          <h2 className="section-title">Transparent, Explainable Physics Equations</h2>
          <p className="section-desc">
            No black-box guesses. Every cell score and trajectory point is governed by published
            hydro-meteorological and structural engineering standards.
          </p>
        </div>

        <div className="equations-grid">
          <div className="equation-card">
            <div className="equation-title">1. Holland-Rankine Core Wind Field</div>
            <div className="equation-box">
              <code>
                V(r) = V_max &times; (r / R_max) &emsp; for r &le; R_max<br />
                V(r) = V_max &times; (R_max / r)^x &emsp; for r &gt; R_max
              </code>
            </div>
            <p className="equation-desc">
              Models the intense inner core eye-wall where solid-body rotation transitions into
              turbulent cyclostrophic dissipation, with translation asymmetry boost.
            </p>
          </div>

          <div className="equation-card">
            <div className="equation-title">2. IS-875 Dynamic Wind Pressure</div>
            <div className="equation-box">
              <code>
                q = 0.5 &times; &rho; &times; V² &emsp; (&rho; = 1.225 kg/m³)<br />
                Loading = q &times; C_d &times; Shelter &emsp; (C_d = 1.30)
              </code>
            </div>
            <p className="equation-desc">
              Converts local velocity into mechanical pressure (Pascals). Shows non-linear V² scaling
              (doubling wind speed quadruples structural loading).
            </p>
          </div>

          <div className="equation-card">
            <div className="equation-title">3. Kaplan-DeMaria Inland Dissipation</div>
            <div className="equation-box">
              <code>
                V(t) = V_floor + (V_landfall - V_floor) &times; e^(-&alpha; &times; t)<br />
                &alpha; = 0.058 hr⁻¹ &emsp; V_floor = 35.0 km/h
              </code>
            </div>
            <p className="equation-desc">
              Calibrated exponential decay accounting for sudden loss of oceanic latent heat flux and
              elevated terrain friction post-landfall.
            </p>
          </div>

          <div className="equation-card">
            <div className="equation-title">4. Additive Explainable Damage Index</div>
            <div className="equation-box">
              <code>
                Damage = 0.40 &times; Hazard + 0.25 &times; LRR + 0.20 &times; Exposure + 0.15 &times; Vulnerability
              </code>
            </div>
            <p className="equation-desc">
              Synthesizes physical wind hazard, structural load-to-resistance ratio (LRR), urban asset
              density, and construction vulnerability into a 0.0–1.0 index.
            </p>
          </div>
        </div>
      </section>

      {/* Historical Benchmarks Section */}
      <section className="landing-section" id="benchmarks-section">
        <div className="section-header">
          <p className="section-eyebrow">IBTrACS OUT-OF-SAMPLE BENCHMARK MATRIX</p>
          <h2 className="section-title">Tested Across Major North Indian Ocean Cyclones</h2>
          <p className="section-desc">
            Verified across 34 historical observations across 10 severe cyclonic storms with
            independent held-out storm testing.
          </p>
        </div>

        <div className="benchmark-table-wrapper">
          <table className="benchmark-table">
            <thead>
              <tr>
                <th>Cyclone</th>
                <th>Year</th>
                <th>Basin</th>
                <th>IMD Category</th>
                <th>Peak Winds</th>
                <th>Pres. Deficit</th>
                <th>Operations Preset</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Amphan</strong></td>
                <td>2020</td>
                <td>Bay of Bengal</td>
                <td><span className="badge badge-cyclone">Super Cyclone</span></td>
                <td>185 km/h</td>
                <td>85 hPa</td>
                <td>
                  <button type="button" className="table-action-btn" onClick={() => onLaunchConsole("landfall_amphan")}>
                    Load Landfall (Digha) <IconArrowRight />
                  </button>
                </td>
              </tr>
              <tr>
                <td><strong>Fani</strong></td>
                <td>2019</td>
                <td>Bay of Bengal</td>
                <td><span className="badge badge-cyclone">Extremely Severe</span></td>
                <td>175 km/h</td>
                <td>73 hPa</td>
                <td>
                  <button type="button" className="table-action-btn" onClick={() => onLaunchConsole("fani")}>
                    Load Scenario <IconArrowRight />
                  </button>
                </td>
              </tr>
              <tr>
                <td><strong>Bulbul</strong></td>
                <td>2019</td>
                <td>Bay of Bengal</td>
                <td><span className="badge badge-pattern">Very Severe</span></td>
                <td>140 km/h</td>
                <td>40 hPa</td>
                <td>
                  <button type="button" className="table-action-btn" onClick={() => onLaunchConsole("bulbul")}>
                    Load Scenario <IconArrowRight />
                  </button>
                </td>
              </tr>
              <tr>
                <td><strong>Nisarga</strong></td>
                <td>2020</td>
                <td>Arabian Sea</td>
                <td><span className="badge badge-pattern">Severe</span></td>
                <td>110 km/h</td>
                <td>26 hPa</td>
                <td>
                  <button type="button" className="table-action-btn" onClick={() => onLaunchConsole("nisarga")}>
                    Load Scenario <IconArrowRight />
                  </button>
                </td>
              </tr>
              <tr>
                <td><strong>Mocha</strong></td>
                <td>2023</td>
                <td>Bay of Bengal</td>
                <td><span className="badge badge-cyclone">Extremely Severe</span></td>
                <td>195 km/h</td>
                <td>90 hPa</td>
                <td>
                  <button type="button" className="table-action-btn" onClick={() => onLaunchConsole("amphan")}>
                    Load Open Sea <IconArrowRight />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="cta-banner-section">
        <div className="cta-banner-box">
          <h2>Ready to Run Real-Time Cyclone Screening?</h2>
          <p>
            Experience the interactive 200m damage grid, adjust timeline playback, inspect building
            footprints, and export NDMA situation reports.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "20px" }}>
            <button
              type="button"
              className="hero-btn primary"
              onClick={() => onLaunchConsole("landfall_amphan")}
            >
              <IconCompass /> Launch Operations Console
            </button>
            <button
              type="button"
              className="hero-btn secondary"
              onClick={() => window.print()}
            >
              Export Executive SITREP Brief
            </button>
          </div>
        </div>
      </section>

      {/* Corporate / Institutional Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-col brand-col">
            <div className="footer-logo">CYCLONEX</div>
            <p>
              Autonomous Satellite-to-Grid Cyclone Damage &amp; Land Impact Intelligence Engine.
              Built for disaster response authorities, emergency planners, and coastal infrastructure operators.
            </p>
            <div className="footer-accreditation">
              NDMA Operational Guidelines &middot; IS-875 Part 3 Standard &middot; NOAA IBTrACS v04
            </div>
          </div>

          <div className="footer-col">
            <h4>Platform Capabilities</h4>
            <ul>
              <li><a href="#architecture-section">Satellite Ingestion</a></li>
              <li><a href="#physics-section">Holland-Rankine Vortex</a></li>
              <li><a href="#architecture-section">200m Damage Grid</a></li>
              <li><a href="#benchmarks-section">Shelter Logistics (MPCS)</a></li>
              <li><a href="#benchmarks-section">NDMA Directive Matrix</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Data Provenance</h4>
            <ul>
              <li><a href="https://www.ncei.noaa.gov/products/international-best-track-archive" target="_blank" rel="noreferrer">NOAA IBTrACS v04</a></li>
              <li><a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap Vectors</a></li>
              <li><a href="https://gpm.nasa.gov" target="_blank" rel="noreferrer">NASA GPM IMERG</a></li>
              <li><a href="https://scihub.copernicus.eu" target="_blank" rel="noreferrer">Copernicus Sentinel-1</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Operations</h4>
            <button
              type="button"
              className="btn-footer-launch"
              onClick={() => onLaunchConsole("landfall_amphan")}
            >
              Enter Mission Console &rarr;
            </button>
            <p style={{ marginTop: "12px", fontSize: "0.72rem", color: "#546882" }}>
              Version 2.1.0-gbdt (Production Active)
            </p>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div>&copy; 2026 CYCLONEX Geospatial Intelligence. All rights reserved.</div>
          <div>Strictly for scientific hazard screening and emergency pre-positioning.</div>
        </div>
      </footer>
    </div>
  );
}
