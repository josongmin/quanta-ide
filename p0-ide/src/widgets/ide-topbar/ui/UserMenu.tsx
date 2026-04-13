import { useState, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import BoringAvatar from "boring-avatars";
import { useEscapeKey, useClickOutside } from "@/shared/hooks";
import { Menu, MenuItem as MenuItemPrimitive, MenuSeparator } from "@/shared/ui";

const MOCK_USER = {
  name: "Song Min",
  handle: "@songmin",
  plan: "Pro",
  initials: "SM",
  lastEdited: "Jul 17, 2025, 3:55 PM",
};

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  kbd?: string;
  badge?: string;
  chevron?: boolean;
  toggle?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

function Icon({ d, d2, children }: { d?: string; d2?: string; children?: React.ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d && <path d={d} />}
      {d2 && <path d={d2} />}
      {children}
    </svg>
  );
}

export function UserMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEscapeKey(open, () => { setOpen(false); setQuery(""); });
  useClickOutside(ref, open, () => { setOpen(false); setQuery(""); });

  const sections: { label?: string; items: MenuItem[] }[] = [
    {
      items: [
        {
          id: "profile",
          label: t("ide.user.profile"),
          icon: <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>,
        },
        {
          id: "workspace",
          label: t("ide.user.workspace"),
          icon: <Icon><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></Icon>,
        },
        {
          id: "settings",
          label: t("ide.user.settings"),
          icon: <Icon><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></Icon>,
        },
      ],
    },
    {
      items: [
        {
          id: "notifications",
          label: t("ide.user.notifications"),
          icon: <Icon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>,
          badge: t("ide.user.notifBadge"),
          chevron: true,
        },
        {
          id: "connections",
          label: t("ide.user.connections"),
          icon: <Icon><rect x="2" y="2" width="9" height="9" rx="1.5"/><rect x="13" y="2" width="9" height="9" rx="1.5"/><rect x="2" y="13" width="9" height="9" rx="1.5"/><rect x="13" y="13" width="9" height="9" rx="1.5"/></Icon>,
          badge: "2",
          chevron: true,
        },
        {
          id: "docs",
          label: t("ide.user.docs"),
          icon: <Icon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" d2="M15 3h6v6"><polyline points="10 17 21 6"/></Icon>,
          chevron: false,
        },
      ],
    },
    {
      items: [
        {
          id: "exit",
          label: t("ide.user.exit"),
          danger: true,
          icon: <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>,
          onClick: () => { setOpen(false); setQuery(""); },
        },
      ],
    },
  ];

  const allItems = sections.flatMap((s) => s.items);
  const filtered = query.trim()
    ? allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : null;

  return (
    <div className="usermenu" ref={ref}>
      <button
        type="button"
        className="usermenu-trigger"
        onClick={() => { setOpen((v) => !v); }}
        aria-label="User menu"
        aria-expanded={open}
      >
        <BoringAvatar
          size={21}
          name={MOCK_USER.name}
          variant="pixel"
          colors={["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"]}
        />
        <span className="usermenu-trigger-name">{MOCK_USER.name}</span>
      </button>

      {open && (
        <div className="usermenu-popup" role="dialog" aria-label="User menu">
          {/* Search */}
          <div className="usermenu-search-wrap">
            <svg className="usermenu-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              id={inputId}
              className="usermenu-search"
              type="text"
              placeholder={t("ide.user.searchPlaceholder")}
              value={query}
              onChange={(e) => { setQuery(e.target.value); }}
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>

          <div className="usermenu-scroll">
            {filtered ? (
              <Menu className="usermenu-section">
                {filtered.length === 0 ? (
                  <div className="usermenu-empty">{t("ide.user.noResults")}</div>
                ) : filtered.map((item) => (
                  <MenuRow key={item.id} item={item} />
                ))}
              </Menu>
            ) : (
              <>
                {sections.map((sec, si) => (
                  <Menu key={si} className="usermenu-section">
                    {si > 0 && <MenuSeparator />}
                    {sec.items.map((item) => (
                      <MenuRow key={item.id} item={item} />
                    ))}
                  </Menu>
                ))}

                <MenuSeparator />
                <div className="usermenu-footer">
                  <div className="usermenu-footer-user">
                    <span className="usermenu-footer-name">{t("ide.user.lastEdited")} {MOCK_USER.name}</span>
                    <span className="usermenu-footer-date">{MOCK_USER.lastEdited}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const trailing = (item.badge !== undefined && item.badge !== "") || item.chevron === true ? (
    <>
      {item.badge !== undefined && item.badge !== "" && (
        <span className="usermenu-item-badge">{item.badge}</span>
      )}
      {item.chevron === true && (
        <svg className="usermenu-item-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      )}
    </>
  ) : undefined;
  return (
    <MenuItemPrimitive
      className="usermenu-item"
      icon={item.icon}
      shortcut={trailing}
      variant={item.danger === true ? "danger" : "default"}
      onClick={item.onClick}
    >
      {item.label}
    </MenuItemPrimitive>
  );
}
