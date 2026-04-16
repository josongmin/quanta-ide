import { IconMagic } from "../../lib/icons";

export function TestsView() {
  const suites = [
    { name: "tests/payments/test_retry.py", total: 14, pass: 12, fail: 1, skip: 1, ms: 842, delta: "+2" },
    { name: "tests/payments/test_ledger.py", total: 9, pass: 9, fail: 0, skip: 0, ms: 412, delta: "+0" },
    { name: "tests/shared/test_idempotency.py", total: 8, pass: 8, fail: 0, skip: 0, ms: 86, delta: "new" },
    { name: "tests/payments/test_refund_integration.py", total: 6, pass: 5, fail: 1, skip: 0, ms: 2140, delta: "+0" },
  ];
  return (
    <div className="pr-page__tests">
      <header className="pr-page__tests-head">
        <div className="pr-page__tests-summary">
          <div className="pr-page__tests-big">34 / 37</div>
          <div className="pr-page__tests-sub">tests passing · 2 failing · 1 skipped</div>
        </div>
        <div className="pr-page__tests-bars">
          <div className="pr-page__tests-bar">
            <span className="pr-page__tests-bar-k">Total</span>
            <span className="pr-page__tests-bar-track">
              <span className="pr-page__tests-bar-pass" style={{ width: "91%" }} />
              <span className="pr-page__tests-bar-fail" style={{ width: "6%" }} />
              <span className="pr-page__tests-bar-skip" style={{ width: "3%" }} />
            </span>
            <span className="pr-page__tests-bar-v">91%</span>
          </div>
          <div className="pr-page__tests-bar">
            <span className="pr-page__tests-bar-k">Change cov</span>
            <span className="pr-page__tests-bar-track">
              <span className="pr-page__tests-bar-pass" style={{ width: "72%" }} />
              <span className="pr-page__tests-bar-fail" style={{ width: "0%" }} />
            </span>
            <span className="pr-page__tests-bar-v">72%</span>
          </div>
          <div className="pr-page__tests-bar">
            <span className="pr-page__tests-bar-k">Error paths</span>
            <span className="pr-page__tests-bar-track">
              <span className="pr-page__tests-bar-pass" style={{ width: "38%" }} />
            </span>
            <span className="pr-page__tests-bar-v">38%</span>
          </div>
        </div>
      </header>

      <table className="pr-page__tests-table">
        <thead>
          <tr>
            <th>Suite</th>
            <th>Total</th>
            <th>Pass</th>
            <th>Fail</th>
            <th>Skip</th>
            <th>ms</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {suites.map((s) => (
            <tr key={s.name} className={s.fail > 0 ? "is-fail" : ""}>
              <td className="pr-page__tests-name">{s.name}</td>
              <td>{s.total}</td>
              <td className="pr-page__tests-pass">{s.pass}</td>
              <td className="pr-page__tests-fail">{s.fail}</td>
              <td className="pr-page__tests-skip">{s.skip}</td>
              <td>{s.ms}</td>
              <td className="pr-page__tests-delta">{s.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="pr-page__tests-fail-list">
        <header>Failed tests</header>
        <article className="pr-page__tests-fail-item">
          <div className="pr-page__tests-fail-name">
            test_retry.py::test_exponential_backoff_without_jitter
          </div>
          <pre>
            <code>{`AssertionError: jitter window expected [100, 400) got 250
  where 250 == constant(250)`}</code>
          </pre>
          <button type="button" className="pr-page__apply-btn">
            <IconMagic /> Apply engine suggestion
          </button>
        </article>
        <article className="pr-page__tests-fail-item">
          <div className="pr-page__tests-fail-name">
            test_refund_integration.py::test_double_webhook_idempotent
          </div>
          <pre>
            <code>{`LedgerDuplicateWrite: entry=rf_9281 written twice
  at ledger.py:42`}</code>
          </pre>
          <button type="button" className="pr-page__apply-btn">
            <IconMagic /> Apply engine suggestion
          </button>
        </article>
      </section>
    </div>
  );
}
