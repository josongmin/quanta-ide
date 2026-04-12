import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Popover, type PopoverAnchorRect } from "../popover";
import { Menu, MenuItem } from "../menu";
import { IconChevronDown } from "../icons";

export interface SelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  placeholder,
  size = "md",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<PopoverAnchorRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const el = triggerRef.current;
    if (!el) return;
    if (!open) {
      setAnchorRect(el.getBoundingClientRect());
    }
    setOpen((prev) => !prev);
  }, [disabled, open]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback(
    (next: T) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  const rootClass = [
    "select",
    `select--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={rootClass}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleToggle}
      >
        <span className="select__value">
          {selected ? (
            selected.label
          ) : (
            <span className="select__placeholder">{placeholder ?? ""}</span>
          )}
        </span>
        <IconChevronDown className="select__chevron" size={16} />
      </button>
      <Popover
        open={open}
        anchorRect={anchorRect}
        placement="bottom-start"
        onClose={handleClose}
        role="listbox"
        aria-label={ariaLabel}
      >
        <Menu>
          {options.map((opt) => (
            <MenuItem
              key={String(opt.value)}
              icon={opt.icon}
              disabled={opt.disabled}
              active={opt.value === value}
              onClick={() => {
                handleSelect(opt.value);
              }}
            >
              {opt.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </>
  );
}
