import { useState } from "react";
import {
  BookOpen,
  Layers,
  Cpu,
  ShieldCheck,
  Code2,
  Sigma,
  Building2,
  Waves,
  Wind,
  Brain,
  ShieldAlert,
  ArrowRight,
  Activity
} from "lucide-react";

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState<string>("holland");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">

        {/* Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "24px" }}>
          <div>
            <div className="op-section-kicker">
              <BookOpen size={12} style={{ display: "inline", marginRight: "6px" }} />
              SCIENTIFIC &amp; OPERATIONAL METHODOLOGY
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              Technical Methodology &amp; Engineering SOPs
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Mathematical formulations, Holland radial wind physics, IS:875 structural aerodynamic loading,
              Automated Dvorak Technique (ADT), and NDMA 4-stage operational disaster protocols.
            </p>
          </div>
        </div>

        {/* Reading Environment: Left 220px TOC + Center Reading Document */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "48px", alignItems: "start" }}>
          
          {/* Sticky Left TOC */}
          <aside style={{ position: "sticky", top: "24px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
              TABLE OF CONTENTS
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", padding: "6px 0 2px" }}>
                1. Physics &amp; Aerodynamics
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("holland")}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: "11.5px",
                  color: activeSection === "holland" ? "#38bdf8" : "#64748b",
                  fontWeight: activeSection === "holland" ? 600 : 400,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderLeft: activeSection === "holland" ? "2px solid #38bdf8" : "2px solid transparent",
                }}
              >
                Holland (1980) Wind Field
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("is875")}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: "11.5px",
                  color: activeSection === "is875" ? "#38bdf8" : "#64748b",
                  fontWeight: activeSection === "is875" ? 600 : 400,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderLeft: activeSection === "is875" ? "2px solid #38bdf8" : "2px solid transparent",
                }}
              >
                IS 875 Part 3 Facade Load
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("surge")}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: "11.5px",
                  color: activeSection === "surge" ? "#38bdf8" : "#64748b",
                  fontWeight: activeSection === "surge" ? 600 : 400,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderLeft: activeSection === "surge" ? "2px solid #38bdf8" : "2px solid transparent",
                }}
              >
                IIT-D Hydrodynamic Surge
              </button>

              <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", padding: "14px 0 2px" }}>
                2. AI &amp; Satellite Cognition
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("dvorak")}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: "11.5px",
                  color: activeSection === "dvorak" ? "#38bdf8" : "#64748b",
                  fontWeight: activeSection === "dvorak" ? 600 : 400,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderLeft: activeSection === "dvorak" ? "2px solid #38bdf8" : "2px solid transparent",
                }}
              >
                Automated Dvorak (ADT)
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("risk-scoring")}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: "11.5px",
                  color: activeSection === "risk-scoring" ? "#38bdf8" : "#64748b",
                  fontWeight: activeSection === "risk-scoring" ? 600 : 400,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderLeft: activeSection === "risk-scoring" ? "2px solid #38bdf8" : "2px solid transparent",
                }}
              >
                200m Spatial Vulnerability
              </button>

              <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", padding: "14px 0 2px" }}>
                3. Civil Defense Protocols
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("ndma-sops")}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: "11.5px",
                  color: activeSection === "ndma-sops" ? "#38bdf8" : "#64748b",
                  fontWeight: activeSection === "ndma-sops" ? 600 : 400,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderLeft: activeSection === "ndma-sops" ? "2px solid #38bdf8" : "2px solid transparent",
                }}
              >
                NDMA 4-Stage Directives
              </button>
            </div>
          </aside>

          {/* Central Technical Document Content */}
          <main style={{ display: "flex", flexDirection: "column", gap: "40px" }}>

            {/* Section 1: Holland 1980 Wind Field */}
            <section id="holland">
              <div className="op-section-kicker">ATMOSPHERIC PHYSICS</div>
              <h2 className="op-section-title" style={{ fontSize: "22px" }}>1. Holland (1980) Parametric Wind Model</h2>

              <p style={{ fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 16px" }}>
                The Holland 1980 model provides an analytical formulation for the radial surface wind profile of tropical
                cyclones by solving the gradient wind equation under cyclostrophic balance combined with a modified rectangular
                hyperbolic pressure profile.
              </p>

              {/* Visual Process Flow Diagram for Holland */}
              <div className="op-flow-progression" style={{ marginBottom: "16px" }}>
                <div className="op-flow-item">
                  <div className="op-flow-label">INPUTS</div>
                  <div className="op-flow-name">Storm Parameters</div>
                  <div className="op-flow-detail">B, Rmax, Pn - Pc, ρ</div>
                </div>
                <div className="op-flow-arrow">&rarr;</div>
                <div className="op-flow-item">
                  <div className="op-flow-label">EQUATION</div>
                  <div className="op-flow-name">Gradient Solver</div>
                  <div className="op-flow-detail">Cyclostrophic balance</div>
                </div>
                <div className="op-flow-arrow">&rarr;</div>
                <div className="op-flow-item">
                  <div className="op-flow-label">WIND FIELD</div>
                  <div className="op-flow-name">2D Radial Isotachs</div>
                  <div className="op-flow-detail">V(r) continuous curve</div>
                </div>
                <div className="op-flow-arrow">&rarr;</div>
                <div className="op-flow-item">
                  <div className="op-flow-label">OUTPUT</div>
                  <div className="op-flow-name">Quadrant Radii</div>
                  <div className="op-flow-detail">R34, R50, R64 boundaries</div>
                </div>
              </div>

              <div className="op-formula-block">
                V(r) = √[ (B/ρ) · (Rmax/r)^B · (Pn - Pc) · exp(-(Rmax/r)^B) + (r·f/2)^2 ] - (r·f/2)
              </div>

              <div className="op-formula-legend" style={{ marginBottom: "16px" }}>
                Where: <strong>B</strong> is the Holland peaking parameter (typically 1.1–1.5 in the North Indian Ocean); <strong>Rmax</strong> is the radius of maximum winds (km); <strong>Pn</strong> is ambient environmental pressure (1008 hPa); <strong>Pc</strong> is central pressure; <strong>ρ</strong> is air density (1.15 kg/m³); and <strong>f</strong> is the Coriolis parameter \(2\Omega \sin\phi\).
              </div>
            </section>

            {/* Section 2: IS 875 Part 3 Facade Pressure */}
            <section id="is875" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "32px" }}>
              <div className="op-section-kicker">STRUCTURAL ENGINEERING</div>
              <h2 className="op-section-title" style={{ fontSize: "22px" }}>2. IS:875 (Part 3) &mdash; Design Wind Pressure</h2>

              <p style={{ fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 16px" }}>
                The Bureau of Indian Standards (BIS) code IS:875 (Part 3) dictates the design wind loads on buildings and
                structures. CycloneX computes design wind speed \(V_z\) at building height \(z\) and converts it directly
                to aerodynamic facade pressure \(p_z\).
              </p>

              <div className="op-formula-block">
                pz = 0.613 · Vz² = 0.613 · [ Vb · k1 · k2 · k3 · k4 ]²
              </div>

              <div className="op-formula-legend" style={{ marginBottom: "16px" }}>
                <strong>Vb</strong>: Basic wind speed (50 m/s for coastal Konkan zone); <strong>k1</strong>: Risk coefficient (1.08 for 100-year design life); <strong>k2</strong>: Terrain roughness category (1.05 for open coastal sea frontage); <strong>k3</strong>: Topography factor; <strong>k4</strong>: Importance factor for cyclonic storms (1.15).
              </div>
            </section>

            {/* Section 3: IIT-D Hydrodynamic Surge */}
            <section id="surge" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "32px" }}>
              <div className="op-section-kicker">HYDRODYNAMIC MODELING</div>
              <h2 className="op-section-title" style={{ fontSize: "22px" }}>3. IIT-Delhi Coastal Storm Surge Formulation</h2>

              <p style={{ fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 16px" }}>
                Storm surge height \(\eta\) along shallow coastal bathymetries is computed through numerical integration of
                the vertically integrated shallow water hydrodynamic equations:
              </p>

              <div className="op-formula-block">
                ∂η/∂t + ∂(Hu)/∂x + ∂(Hv)/∂y = 0
              </div>

              <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
                Coupled with wind stress forcing &tau; = &rho;a &middot; Cd &middot; |V| &middot; u and inverse barometric effect
                &Delta;&eta; = 0.01 &middot; (Pn - Pc) meters.
              </p>
            </section>

            {/* Section 4: Automated Dvorak Technique */}
            <section id="dvorak" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "32px" }}>
              <div className="op-section-kicker">AI &amp; SATELLITE COGNITION</div>
              <h2 className="op-section-title" style={{ fontSize: "22px" }}>4. Automated Dvorak Technique (ADT) &amp; ConvNet</h2>

              <p style={{ fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 16px" }}>
                The Automated Dvorak Technique determines tropical cyclone intensity objectively from geostationary infrared
                satellite imagery without human subjective bias.
              </p>

              {/* Dvorak Flow Diagram */}
              <div className="op-flow-progression" style={{ marginBottom: "16px" }}>
                <div className="op-flow-item">
                  <div className="op-flow-label">SATELLITE</div>
                  <div className="op-flow-name">INSAT-3DR 10.8µm</div>
                  <div className="op-flow-detail">Cloud-top brightness Tb</div>
                </div>
                <div className="op-flow-arrow">&rarr;</div>
                <div className="op-flow-item">
                  <div className="op-flow-label">PATTERN</div>
                  <div className="op-flow-name">Thermal Anomaly</div>
                  <div className="op-flow-detail">Eye vs CDO contrast</div>
                </div>
                <div className="op-flow-arrow">&rarr;</div>
                <div className="op-flow-item">
                  <div className="op-flow-label">T-NUMBER</div>
                  <div className="op-flow-name">Empirical ADT Scale</div>
                  <div className="op-flow-detail">T1.0 (25 kt) to T8.0 (170 kt)</div>
                </div>
                <div className="op-flow-arrow">&rarr;</div>
                <div className="op-flow-item">
                  <div className="op-flow-label">INTENSITY</div>
                  <div className="op-flow-name">Vmax &amp; Pressure</div>
                  <div className="op-flow-detail">120 km/h · 984 hPa (T4.5)</div>
                </div>
              </div>
            </section>

            {/* Section 5: 200m Spatial Vulnerability */}
            <section id="risk-scoring" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "32px" }}>
              <div className="op-section-kicker">RISK SCORING METHODOLOGY</div>
              <h2 className="op-section-title" style={{ fontSize: "22px" }}>5. 200m Parcel Structural Vulnerability</h2>

              <p style={{ fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 16px" }}>
                CycloneX integrates hazard intensity, asset exposure, and structural fragility into a unified risk metric:
              </p>

              <div className="op-formula-block">
                RISK = HAZARD (Wind pz + Surge η) × EXPOSURE (Parcel Footprint) × VULNERABILITY (Fragility Curves)
              </div>

              <div style={{ marginTop: "16px" }}>
                <table className="op-ledger-table" style={{ fontSize: "11.5px" }}>
                  <thead>
                    <tr>
                      <th>DAMAGE GRADE</th>
                      <th>FAILURE MODE</th>
                      <th>PHYSICAL THRESHOLD</th>
                      <th>ACTION DIRECTIVE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ color: "#ef4444", fontWeight: 700 }}>D4 / D5 (Critical)</td>
                      <td>Complete roof detachment / wall collapse</td>
                      <td>pz &gt; 1.8 kPa</td>
                      <td>Mandatory pre-landfall evacuation</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#f59e0b", fontWeight: 700 }}>D2 / D3 (Moderate)</td>
                      <td>Facade cladding shear, glazing failure</td>
                      <td>1.2 &le; pz &le; 1.8 kPa</td>
                      <td>Shelter in interior rooms</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>D0 / D1 (Nominal)</td>
                      <td>Minor superficial tile displacement</td>
                      <td>pz &lt; 1.2 kPa</td>
                      <td>Standard precautionary alert</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 6: NDMA 4-Stage Alert Protocols */}
            <section id="ndma-sops" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "32px", paddingBottom: "40px" }}>
              <div className="op-section-kicker">DISASTER PROTOCOLS</div>
              <h2 className="op-section-title" style={{ fontSize: "22px" }}>6. NDMA 4-Stage Operational Cyclone Protocol</h2>

              <p style={{ fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 16px" }}>
                National Disaster Management Authority (NDMA) certified 4-stage warning system issued by the Cyclone Warning Division (IMD):
              </p>

              <div className="op-step-pipeline" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="op-step-node">
                  <div className="op-step-idx" style={{ color: "#94a3b8" }}>STAGE 1</div>
                  <div className="op-step-title">Pre-Cyclone Watch</div>
                  <div className="op-step-desc">Issued 72h prior to depression genesis; sea state advisories.</div>
                </div>
                <div className="op-step-node">
                  <div className="op-step-idx" style={{ color: "#f59e0b" }}>STAGE 2</div>
                  <div className="op-step-title">Cyclone Alert (Yellow)</div>
                  <div className="op-step-desc">Issued 48h prior; track cone published; fisheries recall.</div>
                </div>
                <div className="op-step-node">
                  <div className="op-step-idx" style={{ color: "#f97316" }}>STAGE 3</div>
                  <div className="op-step-title">Cyclone Warning (Orange)</div>
                  <div className="op-step-desc">Issued 24h prior; landfall sector named; MPCS shelters pre-opened.</div>
                </div>
                <div className="op-step-node" style={{ borderTopColor: "#ef4444" }}>
                  <div className="op-step-idx" style={{ color: "#ef4444" }}>STAGE 4</div>
                  <div className="op-step-title">Post-Landfall (Red)</div>
                  <div className="op-step-desc">Issued 12h prior to landfall; mandatory evacuation enforced.</div>
                </div>
              </div>
            </section>

          </main>
        </div>

      </div>
    </div>
  );
}
