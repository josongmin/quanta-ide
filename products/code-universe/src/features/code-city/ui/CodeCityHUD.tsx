/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import type { CodeNode } from "../model/types";

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  padding: 16,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#1E293B",
};

const panelWrap: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto 12px",
  pointerEvents: "auto",
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "2px solid #E2E8F0",
  borderRadius: 8,
  padding: 12,
  boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
  display: "flex",
  gap: 14,
  backdropFilter: "blur(6px)",
};

const statRow: React.CSSProperties = {
  marginTop: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  fontSize: 9,
  color: "#64748B",
  borderTop: "1px solid #E2E8F0",
  paddingTop: 8,
};

export interface CodeCityHUDProps {
  activeNode: CodeNode | null;
  maliciousId: string | null;
}

export function CodeCityHUD({ activeNode, maliciousId }: CodeCityHUDProps): React.ReactElement | null {
  const [displayText, setDisplayText] = useState("");
  const [fullText, setFullText] = useState("");

  useEffect(() => {
    if (!activeNode) return;

    let report = `Analyzing [${activeNode.name}]... `;
    if (activeNode.blastRadius > 0.8) {
      report +=
        "RED ALERT: CRITICAL BLAST RADIUS. A failure here could destabilize the entire sector. ";
    }
    if (activeNode.securityLeak) {
      report +=
        "CRITICAL FAILURE: DATA LEAK DETECTED. Red streams indicate unauthorized egress. ";
    }
    if (activeNode.ifNesting > 8) {
      report +=
        "WARNING: IF-STATEMENT HELL. Logic is too deep. Building is encased in nested frames. ";
    }
    if (activeNode.heuristicLevel > 0.7) {
      report +=
        "INTEL: HEURISTIC ANALYSIS active. Purple question marks detected. High guesswork in logic. ";
    }
    if (activeNode.isDead) report += "WARNING: This building is a GHOST. Dead code detected. ";
    if (activeNode.isGodClass) {
      report += "CRITICAL: GOD CLASS DETECTED. Too many responsibilities in one sector. ";
    }
    if (activeNode.aiGenerated) {
      const isMalicious = maliciousId !== null && activeNode.id === maliciousId;
      report += isMalicious
        ? "ALARM: HIGH-RISK SECTOR. Red patrol bot focused on the worst-risk building in this snapshot. "
        : "INTEL: ELEVATED COMPLEXITY PATTERN. Blue drones mark high-churn / high-complexity sectors. ";
    }
    if (activeNode.risk > 0.7) report += "CRITICAL: High risk fire party on-going. Refactor immediately. ";
    if (activeNode.solidViolations > 5) {
      report +=
        "ERROR: Structural integrity compromised. SOLID principles ignored. Building is tilting! ";
    }
    if (activeNode.memoryLeak) report += "NOTICE: Data puddles found. Possible memory leaks in sector. ";
    if (activeNode.complexity > 40) {
      report += `INTEL: Complexity index is ${activeNode.complexity}. Sector is extremely convoluted. `;
    }
    if (activeNode.duplication > 0.4) {
      report += "WARNING: High code duplication. Cloned substructures observed in perimeter. ";
    }
    if (activeNode.coupling > 0.7) {
      report += "ALERT: Extreme coupling detected. Blue lasers connecting to external dependencies. ";
    }
    if (activeNode.busFactor === 0) {
      report +=
        "ALERT: BUS FACTOR ZERO. Concentrated ownership risk — key-person dependency detected. ";
    }

    if (report === `Analyzing [${activeNode.name}]... `) {
      report += "Node is stable. Structural health is OPTIMAL.";
    }

    setFullText(report);
    setDisplayText("");
  }, [activeNode, maliciousId]);

  useEffect(() => {
    if (!fullText) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [fullText]);

  if (!activeNode) return null;

  return (
    <div style={overlay}>
      <div style={panelWrap}>
        <div style={panel}>
          <div
            style={{
              width: 52,
              height: 52,
              background: "#F8FAFC",
              border: "1px solid #3B82F6",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 30,
                height: 38,
                background: "#3B82F6",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ width: 7, height: 7, background: "#fff" }} />
                <span style={{ width: 7, height: 7, background: "#fff" }} />
              </div>
              <div style={{ width: "100%", height: 7, background: "#fff" }} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span
              style={{
                fontSize: 10,
                color: "#334155",
                fontWeight: 700,
                marginBottom: 4,
                letterSpacing: "-0.02em",
              }}
            >
              Code City
            </span>
            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45, color: "#0F172A", minHeight: "1.5rem" }}>
              {displayText}
              <span style={{ opacity: 0.55 }}>_</span>
            </div>

            <div style={statRow}>
              <span>△ RISK: {Math.round(activeNode.risk * 100)}%</span>
              <span>⚡ SOLID: {activeNode.solidViolations}</span>
              <span>▼ DEBT: {Math.round(activeNode.techDebt * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
