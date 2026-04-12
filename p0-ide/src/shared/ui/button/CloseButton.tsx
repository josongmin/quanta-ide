import { forwardRef } from "react";
import { IconClose } from "../icons";
import { IconButton, type IconButtonProps } from "./IconButton";

export interface CloseButtonProps
  extends Omit<IconButtonProps, "children" | "aria-label"> {
  "aria-label"?: string;
  size?: "sm" | "md";
}

export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  function CloseButton(
    { size = "md", "aria-label": ariaLabel = "Close", ...rest },
    ref,
  ) {
    return (
      <IconButton
        ref={ref}
        size={size}
        variant="ghost"
        aria-label={ariaLabel}
        {...rest}
      >
        <IconClose />
      </IconButton>
    );
  },
);
