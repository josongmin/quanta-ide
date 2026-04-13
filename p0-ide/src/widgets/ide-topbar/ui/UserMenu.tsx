import BoringAvatar from "boring-avatars";

const MOCK_USER = {
  name: "Song Min",
};

export function UserMenu() {
  return (
    <div className="usermenu">
      <div className="usermenu-trigger">
        <BoringAvatar
          size={23}
          name={MOCK_USER.name}
          variant="pixel"
          colors={["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"]}
        />
        <span className="usermenu-trigger-name">{MOCK_USER.name}</span>
      </div>
    </div>
  );
}
