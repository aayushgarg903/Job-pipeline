// Server-safe. With `href` it renders a UiLink (next/link when the app registers it).
import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { UiLink } from "./UiLink";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "table";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconAfter?: IconName;
  href?: string;
  children?: ReactNode;
}

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return clsx("ks-btn", variant !== "primary" && `ks-btn--${variant}`, size !== "md" && `ks-btn--${size}`, extra);
}

export function Button({ variant = "primary", size = "md", icon, iconAfter, href, className, children, type, ...rest }: ButtonProps) {
  const cls = buttonClass(variant, size, className);
  const inner = (
    <>
      {icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === "sm" ? 16 : 18} /> : null}
    </>
  );
  if (href) {
    return (
      <UiLink href={href} className={cls} aria-label={rest["aria-label"]}>
        {inner}
      </UiLink>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {inner}
    </button>
  );
}
