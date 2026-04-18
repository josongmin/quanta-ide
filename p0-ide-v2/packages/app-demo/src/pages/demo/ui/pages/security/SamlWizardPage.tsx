import { useState } from "react";
import type { ChangeEvent } from "react";
import {
  Check,
  Upload,
  FileText,
  Shield,
  ShieldCheck,
  Play,
  Trash2,
  Clock,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Step {
  id: string;
  title: string;
  helper: string;
}

const STEPS: Step[] = [
  { id: "sp", title: "Download our metadata", helper: "Give your IdP our Service Provider details." },
  { id: "idp", title: "Upload your IdP metadata", helper: "We parse Entity ID, SSO URL and the signing certificate." },
  { id: "map", title: "Map attributes", helper: "Match IdP claims to Quanta fields." },
  { id: "test", title: "Test & enable", helper: "Run a dry sign-in before cutting over." },
];

interface AttrRow {
  id: string;
  idp: string;
  field: string;
}

const DEFAULT_ATTRS: AttrRow[] = [
  { id: "a1", idp: "email", field: "email" },
  { id: "a2", idp: "displayName", field: "name" },
  { id: "a3", idp: "group", field: "role" },
  { id: "a4", idp: "department", field: "name" },
];

const FIELD_OPTIONS = [
  { value: "email", label: "email" },
  { value: "name", label: "name" },
  { value: "role", label: "role" },
  { value: "external_id", label: "external_id" },
];

const SP_METADATA_XML_URL = "https://quanta.dev/sso/acme/metadata.xml";
const SP_ENTITY_ID = "https://quanta.dev/sso/acme";
const SP_ACS_URL = "https://quanta.dev/sso/acme/acs";

export function SamlWizardPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [attrs, setAttrs] = useState<AttrRow[]>(DEFAULT_ATTRS);
  const [tested, setTested] = useState(false);
  const [enforce, setEnforce] = useState(false);

  const goNext = () => setActiveIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const goBack = () => setActiveIdx((i) => Math.max(0, i - 1));

  const fakeUpload = () => {
    setUploadedFile({ name: "okta-idp-metadata.xml", size: "4.2 KB" });
  };

  const addMapping = () => {
    setAttrs((prev) => [
      ...prev,
      { id: `a${prev.length + 1}-${Date.now()}`, idp: "", field: "email" },
    ]);
  };

  const resetDefaults = () => setAttrs(DEFAULT_ATTRS);

  const continueDisabled =
    activeIdx === 1 && !uploadedFile && pasteUrl.trim() === "";

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Security"
        title="SAML SSO setup"
        sub="Connect your identity provider (Okta, OneLogin, Azure AD, or any SAML 2.0 IdP). Takes ~10 minutes."
      />
      <div className="demo-app__body">
        {/* Stepper */}
        <nav
          aria-label="Setup progress"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            marginBottom: "var(--space-5)",
          }}
        >
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                position: "relative",
                background: "transparent",
                border: 0,
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
              }}
              aria-current={i === activeIdx ? "step" : undefined}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: i <= activeIdx ? "var(--fg)" : "var(--bg-muted)",
                  color: i <= activeIdx ? "var(--bg)" : "var(--fg-subtle)",
                  border: "2px solid var(--bg)",
                  boxShadow:
                    i === activeIdx ? "0 0 0 3px var(--bg-accent-subtle)" : "none",
                  fontWeight: 700,
                  fontSize: "var(--fs-xs)",
                  flex: "0 0 auto",
                  zIndex: 1,
                }}
              >
                {i < activeIdx ? <Check size={14} strokeWidth={2.4} /> : i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color:
                      i <= activeIdx ? "var(--fg-muted)" : "var(--fg-subtle)",
                  }}
                >
                  Step {i + 1}
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-sm)",
                    fontWeight: i === activeIdx ? 700 : 500,
                    color: "var(--fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  style={{
                    position: "absolute",
                    left: 32,
                    right: -12,
                    top: 15,
                    height: 1,
                    background:
                      i < activeIdx ? "var(--fg)" : "var(--border)",
                  }}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </nav>

        {/* Step content */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">{STEPS[activeIdx].title}</div>
              <div className="demo-block__sub">{STEPS[activeIdx].helper}</div>
            </div>
          </header>

          <div className="demo-block__body">
            {activeIdx === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: "var(--lh-relaxed)", margin: 0 }}>
                  Quanta publishes SAML metadata for your workspace. Paste this URL into your
                  IdP, or download the XML and upload it there. This tells your IdP where to
                  send assertions and how to verify our requests.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    gap: "var(--space-1h) var(--space-3)",
                    padding: "var(--space-3)",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>Metadata URL</div>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {SP_METADATA_XML_URL}
                  </code>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>Entity ID</div>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg)" }}>{SP_ENTITY_ID}</code>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>ACS (Reply) URL</div>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg)" }}>{SP_ACS_URL}</code>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>NameID format</div>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg)" }}>
                    urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
                  </code>
                </div>

                <pre className="demo-code" style={{ margin: 0 }}>
{`<EntityDescriptor entityID="https://quanta.dev/sso/acme">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://quanta.dev/sso/acme/acs"
      index="1" />
  </SPSSODescriptor>
</EntityDescriptor>`}
                </pre>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-2h)",
                    padding: "var(--space-2h) var(--space-3)",
                    background: "var(--bg-accent-subtle)",
                    border: "1px solid var(--border-accent-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <Shield size={14} strokeWidth={1.8} style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                    Your SP Entity ID is{" "}
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1px 6px" }}>
                      {SP_ENTITY_ID}
                    </code>
                    . Keep this handy for your IdP config — some providers ask for it separately
                    even after you paste the metadata URL.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button className="demo-btn demo-btn--primary">
                    <FileText size={13} strokeWidth={1.8} /> Download XML
                  </button>
                  <button className="demo-btn demo-btn--ghost">Copy metadata URL</button>
                </div>
              </div>
            )}

            {activeIdx === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: "var(--lh-relaxed)", margin: 0 }}>
                  Export your IdP metadata file from Okta / OneLogin / Azure AD and drop it
                  below. Alternatively paste a metadata URL and we'll fetch it on save.
                </p>

                {!uploadedFile ? (
                  <button
                    type="button"
                    onClick={fakeUpload}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-5) var(--space-4)",
                      border: "1.5px dashed var(--border-strong)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-subtle)",
                      color: "var(--fg)",
                      cursor: "pointer",
                    }}
                  >
                    <Upload size={22} strokeWidth={1.6} style={{ color: "var(--fg-subtle)" }} />
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                      Drag XML here or click to browse
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
                      Accepts <code style={{ fontFamily: "var(--font-mono)" }}>.xml</code> up to 512 KB
                    </div>
                  </button>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      border: "1px solid var(--border-success-subtle)",
                      background: "var(--bg-success-subtle)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg)",
                        color: "var(--success)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileText size={16} strokeWidth={1.8} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg)" }}>
                        {uploadedFile.name}
                      </div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                        {uploadedFile.size} · Parsed 3 claims · Signing cert valid until 2028-11-04
                      </div>
                    </div>
                    <span className="demo-badge demo-badge--success">Valid</span>
                    <button
                      type="button"
                      className="demo-btn demo-btn--ghost"
                      onClick={() => setUploadedFile(null)}
                      aria-label="Remove uploaded file"
                    >
                      Replace
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: 700,
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  or
                  <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>

                <div className="demo-field">
                  <label className="demo-field__label">Paste metadata URL</label>
                  <input
                    type="url"
                    className="demo-input"
                    placeholder="https://acme.okta.com/app/abc123/sso/saml/metadata"
                    value={pasteUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPasteUrl(e.target.value)}
                  />
                  <div className="demo-field__hint">
                    We fetch at save and refresh daily to rotate signing certs automatically.
                  </div>
                </div>
              </div>
            )}

            {activeIdx === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: "var(--lh-relaxed)", margin: 0 }}>
                  Tell us which IdP claim maps to which Quanta user field. We ship sensible
                  defaults that match most providers.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
                    gap: "var(--space-2) var(--space-3)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: "var(--fs-10)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", fontWeight: 700 }}>
                    IdP attribute
                  </div>
                  <div />
                  <div style={{ fontSize: "var(--fs-10)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", fontWeight: 700 }}>
                    Quanta field
                  </div>
                  {attrs.map((row) => (
                    <div key={row.id} style={{ display: "contents" }}>
                      <input
                        type="text"
                        className="demo-input"
                        value={row.idp}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setAttrs((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, idp: e.target.value } : r)),
                          )
                        }
                        placeholder="e.g. emailAddress"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                      />
                      <span style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>→</span>
                      <select
                        className="demo-select"
                        value={row.field}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                          setAttrs((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, field: e.target.value } : r)),
                          )
                        }
                      >
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button className="demo-btn demo-btn--ghost" onClick={addMapping}>
                    + Add another mapping
                  </button>
                  <button className="demo-btn demo-btn--ghost" onClick={resetDefaults}>
                    Use defaults
                  </button>
                </div>
              </div>
            )}

            {activeIdx === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: "var(--lh-relaxed)", margin: 0 }}>
                  We'll open your IdP in a new tab and bounce back with a real assertion. This
                  does not enable SSO for anyone else yet.
                </p>

                <div
                  style={{
                    padding: "var(--space-4)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <button
                      className="demo-btn demo-btn--primary"
                      onClick={() => setTested(true)}
                    >
                      <Play size={13} strokeWidth={1.8} /> Test sign-in
                    </button>
                    {tested && (
                      <span className="demo-badge demo-badge--success">
                        <Check size={11} strokeWidth={2.4} /> Passed
                      </span>
                    )}
                  </div>

                  {tested && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-1h)" }}>
                      {[
                        "IdP reachable (responded in 184ms)",
                        "Assertion valid — signature verified",
                        "Email claim mapped to jordan@acme.com",
                      ].map((line) => (
                        <li
                          key={line}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            fontSize: "var(--fs-sm)",
                            color: "var(--fg)",
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "var(--bg-success-subtle)",
                              color: "var(--success)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <Check size={11} strokeWidth={2.6} />
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {tested && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg)",
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--radius-md)",
                          background: "var(--bg-warn-subtle)",
                          color: "var(--warn)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShieldCheck size={16} strokeWidth={1.8} />
                      </span>
                      <div>
                        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                          Enforce SSO for all members
                        </div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                          Members without SSO will lose access on save.
                        </div>
                      </div>
                      <label className="demo-toggle" aria-label="Enforce SSO for all members">
                        <input
                          type="checkbox"
                          checked={enforce}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setEnforce(e.target.checked)}
                        />
                        <span className="demo-toggle__track" />
                      </label>
                    </div>

                    {enforce && (
                      <div
                        style={{
                          padding: "var(--space-2h) var(--space-3)",
                          background: "var(--bg-warn-subtle)",
                          border: "1px solid var(--border-warn-subtle)",
                          borderRadius: "var(--radius-md)",
                          fontSize: "var(--fs-xs)",
                          color: "var(--fg)",
                          lineHeight: "var(--lh-relaxed)",
                        }}
                      >
                        <strong>4 members</strong> do not have an SSO identity yet: mia@acme.com,
                        dan@acme.com, + 2 more. They will be signed out on save and prompted to
                        re-authenticate through your IdP.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <footer className="demo-block__foot">
            <button
              className="demo-btn demo-btn--ghost"
              onClick={goBack}
              disabled={activeIdx === 0}
            >
              Back
            </button>
            <span className="demo-sectionbar__spacer" />
            <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Clock size={11} strokeWidth={1.8} />
              Step {activeIdx + 1} of {STEPS.length}
            </span>
            {activeIdx < STEPS.length - 1 ? (
              <button
                className="demo-btn demo-btn--primary"
                onClick={goNext}
                disabled={continueDisabled}
              >
                Continue
              </button>
            ) : (
              <button
                className="demo-btn demo-btn--danger"
                disabled={!tested}
              >
                <ShieldCheck size={13} strokeWidth={1.8} /> Save & enable
              </button>
            )}
          </footer>
        </div>

        {/* Side-rail helpful info */}
        <div className="demo-grid-3" style={{ marginTop: "var(--space-4)" }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Provider</div>
            <div className="demo-stat__value" style={{ fontSize: "var(--fs-md)" }}>
              Okta (detected)
            </div>
            <div className="demo-stat__delta">From IdP metadata issuer URL</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Signing cert expiry</div>
            <div className="demo-stat__value" style={{ fontSize: "var(--fs-md)" }}>
              2028-11-04
            </div>
            <div className="demo-stat__delta">Auto-rotates from metadata URL</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Emergency bypass</div>
            <div className="demo-stat__value" style={{ fontSize: "var(--fs-md)" }}>
              Owners keep password
            </div>
            <div className="demo-stat__delta">Prevents lockout if IdP is down</div>
          </div>
        </div>

        {/* Abandon wizard */}
        <div style={{ marginTop: "var(--space-4)", display: "flex", justifyContent: "flex-end" }}>
          <button className="demo-btn demo-btn--ghost" aria-label="Cancel SAML setup">
            <Trash2 size={12} strokeWidth={1.8} /> Cancel setup
          </button>
        </div>
      </div>
    </div>
  );
}
