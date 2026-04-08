/* repo-select.js
 * Hero trigger button → opens light-themed repo modal.
 * Modal has tabs to switch between repos.
 */
(function () {
  /* ── Repo data ─────────────────────────────────────────────────── */
  const REPOS = {
    'acme/payments-api': {
      color: '#a78bfa',
      desc: 'Production Node.js payment gateway with Stripe + PayPal adapters, idempotent webhooks, and a 5-year-old refund flow that no one trusts.',
      stack: ['TypeScript', 'Node.js', 'Fastify', 'PostgreSQL', 'Redis'],
      meta: [
        { k: 'Files',  v: '1,284' },
        { k: 'Lines',  v: '92.4k' },
        { k: 'Tokens', v: '318k' },
        { k: 'Age',    v: '5y' },
      ],
      scenario: 'A real legacy backend with a silent refund bug. Watch p0 trace the webhook chain across 14 files and pinpoint the race condition without you opening a single file.',
      seeds: [
        'Why is the refund webhook flaky?',
        'Map the auth flow end to end',
        'List the top 3 risky files',
      ],
      tree: [
        'acme/payments-api',
        '├── src/',
        '│   ├── routes/',
        '│   │   ├── webhooks.ts',
        '│   │   └── refunds.ts',
        '│   ├── adapters/',
        '│   │   ├── stripe.ts',
        '│   │   └── paypal.ts',
        '│   ├── services/',
        '│   │   ├── refund-engine.ts',
        '│   │   └── idempotency.ts',
        '│   └── db/',
        '│       └── ledger.ts',
        '├── tests/',
        '└── package.json',
      ].join('\n'),
    },

    'orbit/web-dashboard': {
      color: '#60a5fa',
      desc: 'A React analytics dashboard with 38 components, 6 data hooks, and one <OrdersTable/> that has quietly grown to 1,200 lines.',
      stack: ['React 18', 'TypeScript', 'Vite', 'TanStack Query', 'Zustand'],
      meta: [
        { k: 'Files',      v: '412' },
        { k: 'Components', v: '38' },
        { k: 'Lines',      v: '34.1k' },
        { k: 'Tokens',     v: '128k' },
      ],
      scenario: 'A tangled frontend that begs to be split. p0 reads the entire component graph, finds shared state leaks, and proposes a refactor that actually compiles.',
      seeds: [
        'Where does Filters state live?',
        'Refactor <OrdersTable/> into smaller pieces',
        'Find unused components',
      ],
      tree: [
        'orbit/web-dashboard',
        '├── src/',
        '│   ├── pages/',
        '│   │   ├── Overview.tsx',
        '│   │   └── Orders.tsx',
        '│   ├── components/',
        '│   │   ├── OrdersTable.tsx  ⚠ 1,212 ln',
        '│   │   ├── Filters.tsx',
        '│   │   └── charts/',
        '│   ├── hooks/',
        '│   │   └── useOrders.ts',
        '│   └── store/',
        '├── public/',
        '└── vite.config.ts',
      ].join('\n'),
    },

    'kettle/data-pipeline': {
      color: '#86efac',
      desc: 'A 5-year-old Python ETL pipeline with 47 DAGs, three generations of code style, and exactly zero people who remember how the users table got there.',
      stack: ['Python 3.11', 'Airflow', 'dbt', 'Snowflake', 'Pandas'],
      meta: [
        { k: 'DAGs',   v: '47' },
        { k: 'Models', v: '128' },
        { k: 'Lines',  v: '61.7k' },
        { k: 'Tokens', v: '244k' },
      ],
      scenario: 'Code archaeology mode. p0 walks the dependency graph, identifies upstream tables, and answers "what breaks if I drop this column?" before you have to find out the hard way.',
      seeds: [
        'Walk me through the ingestion stage',
        'Which DAGs touch the users table?',
        'What breaks if I drop column email_v2?',
      ],
      tree: [
        'kettle/data-pipeline',
        '├── dags/',
        '│   ├── ingest/',
        '│   │   ├── users_v2.py',
        '│   │   └── events.py',
        '│   ├── transform/',
        '│   │   └── enrich_orders.py',
        '│   └── export/',
        '├── dbt/',
        '│   ├── models/',
        '│   │   ├── staging/',
        '│   │   └── marts/',
        '│   └── dbt_project.yml',
        '└── airflow.cfg',
      ].join('\n'),
    },

    'forge/checkout-saas': {
      color: '#fbbf24',
      desc: 'A Next.js SaaS boilerplate with auth, billing skeleton, and a checkout flow waiting for its third pricing tier.',
      stack: ['Next.js 14', 'TypeScript', 'Prisma', 'Stripe', 'Tailwind'],
      meta: [
        { k: 'Routes', v: '32' },
        { k: 'Models', v: '14' },
        { k: 'Lines',  v: '21.3k' },
        { k: 'Tokens', v: '94k' },
      ],
      scenario: 'Greenfield-ish. p0 reads the existing billing seams, plans the schema diff, and writes the new tier end to end — API route, UI, Stripe webhook, the lot.',
      seeds: [
        'Add a Stripe subscription tier',
        'Wire email receipts after checkout',
        'Where would I add an admin route?',
      ],
      tree: [
        'forge/checkout-saas',
        '├── app/',
        '│   ├── (marketing)/',
        '│   ├── (app)/',
        '│   │   ├── dashboard/',
        '│   │   └── billing/',
        '│   └── api/',
        '│       └── stripe/',
        '│           └── webhook/route.ts',
        '├── lib/',
        '│   ├── stripe.ts',
        '│   └── auth.ts',
        '├── prisma/',
        '│   └── schema.prisma',
        '└── next.config.js',
      ].join('\n'),
    },
  };

  /* ── Trigger button ────────────────────────────────────────────── */
  const trigger = document.getElementById('repo-select-trigger');
  if (!trigger) return;
  const triggerName = trigger.querySelector('.repo-select-name');
  const triggerDot = trigger.querySelector('.repo-select-dot');

  let currentRepo = 'acme/payments-api';

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(currentRepo);
  });

  /* ── Modal ─────────────────────────────────────────────────────── */
  const modal = document.getElementById('repo-modal');
  const elDot = document.getElementById('repo-modal-dot');
  const elName = document.getElementById('repo-modal-name');
  const elDesc = document.getElementById('repo-modal-desc');
  const elStack = document.getElementById('repo-modal-stack');
  const elMeta = document.getElementById('repo-modal-meta');
  const elScenario = document.getElementById('repo-modal-scenario');
  const elSeeds = document.getElementById('repo-modal-seeds');
  const elTree = document.getElementById('repo-modal-tree');
  const tabs = Array.from(document.querySelectorAll('.repo-modal-tab'));

  function renderRepo(name) {
    const data = REPOS[name];
    if (!data) return;
    currentRepo = name;

    // sync trigger
    triggerName.textContent = name;
    triggerDot.style.setProperty('--dot', data.color);

    // sync tabs
    tabs.forEach((t) => {
      const on = t.dataset.name === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    // sync modal content
    elName.textContent = name;
    elDesc.textContent = data.desc;
    elDot.style.setProperty('--dot', data.color);
    modal.style.setProperty('--accent', data.color);

    elStack.innerHTML = data.stack
      .map((s) => `<span class="repo-modal-pill">${s}</span>`)
      .join('');

    elMeta.innerHTML = data.meta
      .map(
        (m) => `
        <div class="repo-modal-meta">
          <div class="repo-modal-meta-k">${m.k}</div>
          <div class="repo-modal-meta-v">${m.v}</div>
        </div>`
      )
      .join('');

    elScenario.textContent = data.scenario;

    elSeeds.innerHTML = data.seeds
      .map((s) => `<button type="button" class="repo-modal-seed">${s}</button>`)
      .join('');

    elTree.textContent = data.tree;
  }

  function openModal(name) {
    renderRepo(name);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('is-open'));
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      modal.hidden = true;
      document.body.style.overflow = '';
    }, 180);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      renderRepo(tab.dataset.name);
    });
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]')) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
})();
