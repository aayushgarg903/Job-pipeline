"use client";
// Router-agnostic link. The app registers next/link once with <LinkProvider>;
// @ks/ui stays free of a `next` dependency. Falls back to a plain <a>.
import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from "react";

export type LinkLike = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }>;

const LinkContext = createContext<LinkLike | null>(null);

export function LinkProvider({ component, children }: { component: LinkLike; children: ReactNode }) {
  return <LinkContext.Provider value={component}>{children}</LinkContext.Provider>;
}

export type UiLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };

export function UiLink({ href, children, ...rest }: UiLinkProps) {
  const L = useContext(LinkContext);
  const external = /^https?:\/\//.test(href);
  if (!L || external) {
    return (
      <a href={href} {...(external ? { rel: "noopener noreferrer" } : null)} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <L href={href} {...rest}>
      {children}
    </L>
  );
}
