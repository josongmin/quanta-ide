import { DemoAppHero } from "../../internal/DemoAppHero";

export function TermsPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Legal"
        title="Terms of Service"
        sub="Last updated: April 1, 2026 · Effective: April 15, 2026"
      />
      <div className="demo-app__body">
        <div className="demo-prose">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Quanta
            platform, including the IDE, Code Universe, analysis engines, and related services
            (&quot;Services&quot;). By using the Services, you agree to these Terms.
          </p>

          <h2>1. Accounts</h2>
          <p>
            You must provide accurate information when creating an account and keep your
            credentials secure. You are responsible for activity under your account. Workspace
            owners may administer members, including revoking access.
          </p>

          <h2>2. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Violate applicable law, or any third-party rights.</li>
            <li>Upload content that infringes copyright, contains malware, or is unlawful.</li>
            <li>Attempt to reverse engineer the analysis engines beyond what is permitted by law.</li>
            <li>Use the Services to build a directly competing product.</li>
          </ul>

          <h2>3. Your content</h2>
          <p>
            You retain all rights to the code, rules, and artifacts you upload (&quot;Your
            Content&quot;). You grant Quanta a worldwide, non-exclusive license to host, analyze,
            and process Your Content solely to provide the Services.
          </p>

          <h2>4. Fees &amp; billing</h2>
          <p>
            Paid plans are billed in advance, monthly or yearly as you select. Seats added
            mid-cycle are prorated. Refunds are discretionary and handled case-by-case.
          </p>

          <h2>5. Termination</h2>
          <p>
            You may cancel your subscription at any time. We may suspend access for material breach
            after reasonable notice, except where law or security requires immediate action.
          </p>

          <h2>6. Warranty disclaimer</h2>
          <p>
            The Services are provided &quot;as is&quot; without warranty of any kind. Analysis
            outputs are signals, not guarantees — review before merging.
          </p>

          <h2>7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Quanta&apos;s aggregate liability for claims
            arising from these Terms will not exceed the amount you paid in the preceding 12
            months.
          </p>

          <h2>8. Changes</h2>
          <p>
            We may update these Terms. Material changes are announced at least 30 days in advance.
            Continued use after the effective date constitutes acceptance.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions? <a className="demo-link" href="mailto:legal@quanta.dev">legal@quanta.dev</a>
          </p>
        </div>
      </div>
    </div>
  );
}
