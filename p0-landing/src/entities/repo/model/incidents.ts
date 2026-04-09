import type { IncidentData } from "./types";

export const INCIDENTS = {
  "axios/axios": {
    color: "#ef4444",
    kind: "Supply Chain Backdoor",
    language: "JavaScript",
    cve: "CVE-2023-45857",
    severity: "Critical",
    date: "2023-11-08",
    repo: "axios/axios",
    desc: "A CSRF/SSRF vulnerability in Axios that inadvertently exposes confidential cookies by attaching them to cross-site requests, enabling session hijacking at scale.",
    impact: "Any application using Axios <=1.6.0 unknowingly leaks session tokens in cross-origin requests. Attackers can hijack authenticated sessions without user interaction.",
    howP0Catches: "p0 traces cookie propagation across request boundaries, flags cross-origin header attachment patterns, and detects when session-sensitive headers bypass same-origin policy checks.",
    signals: ["Cross-origin cookie leak", "XSRF-TOKEN header exposure", "No same-origin guard", "Adapter bypass path", "Silent credential forwarding"],
    meta: [{ k: "CVSS", v: "10.0" }, { k: "Affected", v: "54M+" }, { k: "Days exposed", v: "147" }, { k: "Patch lag", v: "23d" }],
    questions: [
      {
        ask: "How does the cookie leak across origins?",
        answerTitle: "XSRF-TOKEN header is attached unconditionally to all requests",
        answerSummary: "p0 traces the request interceptor chain and shows that the XSRF token cookie is read and attached as a header regardless of the request destination, bypassing same-origin protections.",
        answerBullets: ["Maps the interceptor chain that attaches headers", "Shows the missing origin check before header injection", "Identifies the adapter path that skips CORS validation"],
        stats: [{ k: "Leak paths", v: "3" }, { k: "Interceptors", v: "7" }, { k: "Missing guards", v: "2" }],
        artifacts: ["Request flow trace", "Cookie propagation map", "Patch recommendation"],
      },
      {
        ask: "Which downstream apps are most at risk?",
        answerTitle: "Apps using withCredentials + custom XSRF config are fully exposed",
        answerSummary: "p0 analyzes configuration patterns across the ecosystem and identifies which usage patterns create the widest attack surface for session hijacking.",
        answerBullets: ["Ranks config combinations by exposure severity", "Identifies apps with custom XSRF cookie names", "Flags SSR frameworks with server-side cookie access"],
        stats: [{ k: "High-risk patterns", v: "4" }, { k: "SSR exposure", v: "12" }, { k: "Config combos", v: "9" }],
        artifacts: ["Risk pattern matrix", "SSR exposure report", "Mitigation priority list"],
      },
    ],
    tree: `axios/axios
├── lib/
│   ├── adapters/
│   │   ├── http.js        ← server adapter (no CORS)
│   │   └── xhr.js         ← browser adapter
│   ├── core/
│   │   ├── Axios.js
│   │   └── dispatchRequest.js
│   ├── helpers/
│   │   └── cookies.js     ← XSRF read
│   └── defaults/
│       └── index.js       ← xsrfCookieName
├── test/
└── package.json`,
  },
  "apache/log4j": {
    color: "#ef4444",
    kind: "Remote Code Execution",
    language: "Java",
    cve: "CVE-2021-44228",
    severity: "Critical",
    date: "2021-12-09",
    repo: "apache/log4j",
    desc: "Log4Shell: a zero-day RCE in Apache Log4j 2 that allows attackers to execute arbitrary code via crafted log messages containing JNDI lookup strings.",
    impact: "Virtually every Java application using Log4j 2.x was vulnerable. Attackers could achieve full remote code execution by injecting a single string into any logged input.",
    howP0Catches: "p0 traces user-controlled input through logging call sites, detects JNDI lookup resolution in string substitution, and flags unrestricted class loading from remote sources.",
    signals: ["JNDI lookup in log path", "User input → logger sink", "Remote classloader invocation", "No lookup restriction", "Recursive substitution"],
    meta: [{ k: "CVSS", v: "10.0" }, { k: "Affected", v: "3B+" }, { k: "Days exposed", v: "2,920" }, { k: "Patch lag", v: "9d" }],
    questions: [
      {
        ask: "How does user input reach the JNDI lookup?",
        answerTitle: "Any logged string triggers recursive message substitution with JNDI resolution",
        answerSummary: "p0 traces from HTTP request parameters through application logging calls into Log4j's MessagePatternConverter, where ${jndi:ldap://...} triggers an outbound LDAP connection and remote class load.",
        answerBullets: ["Maps input sources that reach logger.info/error/debug", "Shows the substitution chain in PatternLayout", "Identifies the JNDI resolver that fetches remote objects"],
        stats: [{ k: "Input paths", v: "42" }, { k: "Sink points", v: "18" }, { k: "Lookup types", v: "6" }],
        artifacts: ["Taint flow graph", "JNDI resolution chain", "Exploitation path trace"],
      },
      {
        ask: "Which services in our stack are exposed?",
        answerTitle: "Exposure spans web servers, queue consumers, and batch jobs",
        answerSummary: "p0 scans dependency trees across services to find Log4j 2.x usage, then traces which services actually log user-controlled data through vulnerable code paths.",
        answerBullets: ["Inventories direct and transitive Log4j dependencies", "Ranks services by input surface area", "Identifies WAF bypass patterns in logged headers"],
        stats: [{ k: "Services", v: "31" }, { k: "Direct deps", v: "14" }, { k: "Transitive", v: "17" }],
        artifacts: ["Dependency inventory", "Service exposure ranking", "WAF gap analysis"],
      },
    ],
    tree: `apache/log4j
├── log4j-core/
│   └── src/main/java/
│       └── org/apache/logging/log4j/core/
│           ├── lookup/
│           │   ├── JndiLookup.java    ← RCE trigger
│           │   └── Interpolator.java
│           ├── pattern/
│           │   └── MessagePatternConverter.java
│           └── appender/
├── log4j-api/
└── pom.xml`,
  },
  "polyfill-io/polyfill": {
    color: "#f97316",
    kind: "CDN Supply Chain Attack",
    language: "JavaScript",
    cve: "CVE-2024-38526",
    severity: "Critical",
    date: "2024-06-25",
    repo: "polyfill-io/polyfill",
    desc: "The polyfill.io domain was acquired by a malicious actor who injected targeted malware into the CDN-served JavaScript, affecting 100k+ sites that trusted the CDN.",
    impact: "Over 100,000 websites loading scripts from cdn.polyfill.io began serving malware to visitors. The injected code redirected mobile users to scam sites using sophisticated fingerprinting.",
    howP0Catches: "p0 flags external CDN dependencies without integrity hashes, detects domain ownership changes in supply chain, and traces script injection patterns that target specific user agents.",
    signals: ["No SRI hash on CDN script", "Domain ownership transfer", "UA-conditional payload", "Dynamic script injection", "Obfuscated redirect chain"],
    meta: [{ k: "CVSS", v: "9.8" }, { k: "Affected", v: "100k+" }, { k: "Days exposed", v: "90+" }, { k: "Patch lag", v: "N/A" }],
    questions: [
      {
        ask: "How does the malicious payload target victims?",
        answerTitle: "UA fingerprinting selectively serves malware to mobile visitors",
        answerSummary: "p0 deobfuscates the injected script and reveals a multi-stage payload that checks User-Agent, referrer, and time-of-day to selectively redirect mobile users through a chain of scam domains.",
        answerBullets: ["Extracts the fingerprinting logic from obfuscated code", "Maps the redirect chain through intermediate domains", "Shows how the payload evades security scanners"],
        stats: [{ k: "Redirect hops", v: "4" }, { k: "Target UAs", v: "12" }, { k: "Evasion checks", v: "6" }],
        artifacts: ["Deobfuscated payload", "Redirect chain map", "Fingerprint logic breakdown"],
      },
      {
        ask: "Are we loading any compromised polyfill scripts?",
        answerTitle: "Any reference to cdn.polyfill.io is now a live supply chain risk",
        answerSummary: "p0 scans HTML templates, build configs, and CDN references across your codebase to find any script tags, import maps, or dynamic loaders pointing to the compromised domain.",
        answerBullets: ["Searches HTML, JSX, and template files for polyfill.io references", "Checks build tool configs for CDN fallbacks", "Verifies SRI hashes on remaining third-party scripts"],
        stats: [{ k: "References found", v: "7" }, { k: "Missing SRI", v: "5" }, { k: "Safe alternatives", v: "3" }],
        artifacts: ["CDN reference audit", "SRI gap report", "Migration checklist"],
      },
    ],
    tree: `polyfill-io/polyfill
├── polyfill-service/
│   ├── server/
│   │   └── index.js        ← CDN entry
│   ├── lib/
│   │   ├── get-polyfills.js
│   │   └── ua-parser.js    ← UA targeting
│   └── polyfills/
│       ├── Array.from/
│       └── Promise/
├── cdn-config/
└── package.json`,
  },
  "xz-utils/xz": {
    color: "#ef4444",
    kind: "Backdoor via Build System",
    language: "C / Shell",
    cve: "CVE-2024-3094",
    severity: "Critical",
    date: "2024-03-29",
    repo: "xz-utils/xz",
    desc: "A sophisticated backdoor injected into xz/liblzma via malicious build scripts, targeting OpenSSH authentication on Linux systems. Discovered by accident through a performance anomaly.",
    impact: "Compromised liblzma would intercept OpenSSH RSA key verification, allowing attackers with a specific Ed448 key to bypass authentication on any affected Linux server.",
    howP0Catches: "p0 detects obfuscated build-system modifications, flags binary test fixtures that serve as encrypted payloads, and traces unauthorized symbol interposition in shared library loading.",
    signals: ["Obfuscated m4 macro", "Binary test fixture payload", "ifunc resolver hijack", "Build-only code path", "Social engineering commit history"],
    meta: [{ k: "CVSS", v: "10.0" }, { k: "Affected", v: "Linux" }, { k: "Days exposed", v: "~60" }, { k: "Patch lag", v: "2d" }],
    questions: [
      {
        ask: "How does the backdoor survive the build process?",
        answerTitle: "Malicious m4 macros extract an encrypted payload from test fixtures during build",
        answerSummary: "p0 traces the build pipeline from configure scripts through m4 macro expansion, revealing how a modified build-to-host.m4 extracts and decrypts a binary blob hidden in test/files/, injecting it into liblzma at link time.",
        answerBullets: ["Identifies the modified m4 macro that triggers extraction", "Maps the decryption chain from test fixture to object file", "Shows the ifunc resolver that redirects RSA_public_decrypt"],
        stats: [{ k: "Build stages", v: "5" }, { k: "Hidden files", v: "2" }, { k: "Hooked symbols", v: "1" }],
        artifacts: ["Build chain trace", "Payload extraction flow", "Symbol interposition map"],
      },
      {
        ask: "How was the attacker's identity concealed?",
        answerTitle: "A two-year social engineering campaign built trusted committer status",
        answerSummary: "p0 analyzes commit history patterns, reviewer relationships, and permission escalation to reveal how the attacker gradually gained merge access through sustained, legitimate-looking contributions.",
        answerBullets: ["Graphs commit frequency and reviewer trust over time", "Identifies the permission escalation points", "Flags the pressure campaign against the original maintainer"],
        stats: [{ k: "Months active", v: "24" }, { k: "Legit commits", v: "700+" }, { k: "Pressure events", v: "6" }],
        artifacts: ["Commit history timeline", "Trust escalation graph", "Social engineering indicators"],
      },
    ],
    tree: `xz-utils/xz
├── src/
│   └── liblzma/
│       ├── check/
│       │   └── crc64_fast.c   ← ifunc hook
│       └── liblzma.map
├── m4/
│   └── build-to-host.m4      ← backdoor trigger
├── tests/
│   └── files/
│       ├── bad-3-corrupt_lzma2.xz  ← payload
│       └── good-large_compressed.lzma
├── CMakeLists.txt
└── configure.ac`,
  },
  "tj-actions/changed-files": {
    color: "#f97316",
    kind: "CI/CD Pipeline Compromise",
    language: "GitHub Actions",
    cve: "CVE-2025-30066",
    severity: "Critical",
    date: "2025-03-15",
    repo: "tj-actions/changed-files",
    desc: "A compromised GitHub Action that exfiltrated CI/CD secrets by injecting a malicious step that dumped runner memory and posted secrets to an attacker-controlled endpoint.",
    impact: "Any repository using tj-actions/changed-files@v35-v44 had its CI runner secrets (API keys, deploy tokens, cloud credentials) exfiltrated during workflow execution.",
    howP0Catches: "p0 audits GitHub Action references for tag mutability, detects unexpected network calls in CI steps, and flags actions that access secrets beyond their declared scope.",
    signals: ["Mutable tag reference", "Post-run secret dump", "Undeclared network egress", "Runner memory access", "Tag force-push history"],
    meta: [{ k: "CVSS", v: "9.8" }, { k: "Affected", v: "23k+" }, { k: "Days exposed", v: "4" }, { k: "Patch lag", v: "1d" }],
    questions: [
      {
        ask: "How did the action exfiltrate secrets?",
        answerTitle: "A post-run step dumped process memory and sent it to an external endpoint",
        answerSummary: "p0 traces the action's lifecycle hooks and reveals a post-execution step that reads /proc/self/environ and runner temp files, base64-encodes the contents, and POSTs them to a controlled server.",
        answerBullets: ["Maps the injected post-run lifecycle hook", "Shows the environment variable dump mechanism", "Traces the exfiltration HTTP call and destination"],
        stats: [{ k: "Secrets exposed", v: "all" }, { k: "Exfil endpoints", v: "2" }, { k: "Affected versions", v: "10" }],
        artifacts: ["Action lifecycle trace", "Exfiltration flow diagram", "Secret exposure inventory"],
      },
      {
        ask: "How do we audit our workflows for this pattern?",
        answerTitle: "Pin actions to commit SHAs and audit for mutable tag references",
        answerSummary: "p0 scans all workflow files for actions referenced by mutable tags, checks for force-push history on referenced tags, and verifies that secret access matches declared permissions.",
        answerBullets: ["Lists all mutable action references across workflows", "Checks tag immutability via GitHub API", "Recommends SHA pinning for each vulnerable reference"],
        stats: [{ k: "Mutable refs", v: "14" }, { k: "Unpinned actions", v: "9" }, { k: "Secret scopes", v: "6" }],
        artifacts: ["Workflow audit report", "SHA pinning migration", "Action trust inventory"],
      },
    ],
    tree: `tj-actions/changed-files
├── .github/
│   └── workflows/
│       └── test.yml
├── src/
│   ├── main.ts
│   ├── utils.ts
│   └── post.ts            ← injected exfil
├── action.yml             ← post step hook
├── dist/
│   └── index.js           ← compiled payload
└── package.json`,
  },
  "event-stream/flatmap": {
    color: "#ef4444",
    kind: "Dependency Hijack",
    language: "JavaScript",
    cve: "CVE-2018-16492",
    severity: "Critical",
    date: "2018-11-26",
    repo: "event-stream/flatmap",
    desc: "A trusted npm package was handed to a new maintainer who injected an encrypted payload targeting the Copay Bitcoin wallet, stealing cryptocurrency from end users.",
    impact: "The flatmap-stream dependency injected into event-stream contained encrypted code that activated only inside the Copay wallet app, stealing Bitcoin private keys and sending them to an attacker.",
    howP0Catches: "p0 detects maintainer ownership transfers, flags encrypted or obfuscated payloads in dependencies, and traces conditional activation patterns that target specific host applications.",
    signals: ["Maintainer transfer", "Encrypted payload in dep", "Conditional activation guard", "Targeted app fingerprint", "Minified injection layer"],
    meta: [{ k: "CVSS", v: "9.8" }, { k: "Affected", v: "8M+" }, { k: "Days exposed", v: "62" }, { k: "Patch lag", v: "8d" }],
    questions: [
      {
        ask: "How does the payload activate only in Copay?",
        answerTitle: "The encrypted code checks for Copay's specific module structure before decrypting",
        answerSummary: "p0 traces the flatmap-stream dependency through its minified entry point and reveals a conditional check for a specific module path unique to the Copay wallet, which serves as the decryption key for the malicious payload.",
        answerBullets: ["Deobfuscates the conditional activation check", "Shows how the Copay module path acts as a decryption key", "Maps the private key exfiltration flow"],
        stats: [{ k: "Activation checks", v: "3" }, { k: "Target apps", v: "1" }, { k: "Exfil channels", v: "2" }],
        artifacts: ["Payload activation flow", "Decryption chain analysis", "Exfiltration network trace"],
      },
      {
        ask: "How was the maintainer transfer exploited?",
        answerTitle: "Social engineering gave a new maintainer publish access to a high-value package",
        answerSummary: "p0 analyzes npm publish history and maintainer changes to show how the attacker offered to 'help maintain' the dormant package, gained publish rights, then injected a malicious transitive dependency.",
        answerBullets: ["Maps the ownership transfer timeline", "Shows the added dependency that carried the payload", "Identifies the version range that auto-upgraded consumers"],
        stats: [{ k: "Publish events", v: "4" }, { k: "Maintainer changes", v: "1" }, { k: "Auto-upgraded", v: "8M+" }],
        artifacts: ["Publish history timeline", "Dependency injection trace", "Consumer impact analysis"],
      },
    ],
    tree: `event-stream/flatmap
├── event-stream/
│   ├── index.js
│   ├── test/
│   └── package.json       ← added flatmap-stream
├── flatmap-stream/
│   ├── index.js            ← minified payload
│   ├── test/
│   │   └── test.js         ← encrypted blob
│   └── package.json
└── node_modules/`,
  },
} as const satisfies Record<string, IncidentData>;

export type IncidentName = keyof typeof INCIDENTS;
export const INCIDENT_NAMES = Object.keys(INCIDENTS) as IncidentName[];
