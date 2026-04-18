import { Camera } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

export function ProfilePage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Profile"
        title="Personal information"
        sub="This is visible to your teammates. Your login email cannot be changed here."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <div className="demo-block__body" style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span className="demo-avatar demo-avatar--xl">AL</span>
              <button className="demo-btn demo-btn--ghost" style={{ padding: "0 10px", height: 28, fontSize: "var(--fs-xs)" }}>
                <Camera size={12} strokeWidth={1.8} /> Change
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="demo-field">
                <label className="demo-field__label">First name</label>
                <input className="demo-input" defaultValue="Ada" />
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Last name</label>
                <input className="demo-input" defaultValue="Lovelace" />
              </div>
              <div className="demo-field" style={{ gridColumn: "1 / -1" }}>
                <label className="demo-field__label">Display name</label>
                <input className="demo-input" defaultValue="ada" />
                <span className="demo-field__hint">Appears beside your messages and approvals.</span>
              </div>
              <div className="demo-field" style={{ gridColumn: "1 / -1" }}>
                <label className="demo-field__label">Email</label>
                <input className="demo-input" defaultValue="ada@acme.com" disabled />
                <span className="demo-field__hint">To change your login email, open a support ticket.</span>
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Timezone</label>
                <select className="demo-select" defaultValue="Asia/Seoul">
                  <option>UTC</option>
                  <option>America/Los_Angeles</option>
                  <option>America/New_York</option>
                  <option>Europe/London</option>
                  <option>Asia/Seoul</option>
                  <option>Asia/Tokyo</option>
                </select>
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Language</label>
                <select className="demo-select" defaultValue="en">
                  <option value="en">English</option>
                  <option value="ko">한국어</option>
                  <option value="ja">日本語</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <div className="demo-field" style={{ gridColumn: "1 / -1" }}>
                <label className="demo-field__label">Bio</label>
                <textarea className="demo-textarea" defaultValue="Programmer. Writer. Long-range poet." rows={3} />
              </div>
            </div>
          </div>
          <div className="demo-block__foot">
            <button className="demo-btn demo-btn--ghost">Cancel</button>
            <button className="demo-btn demo-btn--primary">Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
