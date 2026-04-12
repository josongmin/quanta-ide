import * as RadixAvatar from "@radix-ui/react-avatar";

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ src, alt, initials, size = "md", className }: AvatarProps) {
  return (
    <RadixAvatar.Root className={`avatar avatar--${size} ${className ?? ""}`}>
      {src && <RadixAvatar.Image className="avatar__image" src={src} alt={alt ?? ""} />}
      <RadixAvatar.Fallback className="avatar__fallback">
        {initials ?? alt?.charAt(0).toUpperCase() ?? "?"}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
