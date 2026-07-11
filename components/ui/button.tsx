import { cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-terracotta bg-gradient-to-b from-terracotta to-[#9f5533] text-cream shadow-lg shadow-terracotta/20 hover:brightness-110",
  secondary:
    "border-bronze/40 bg-bronze/10 text-bronze hover:border-bronze hover:bg-bronze/15",
  ghost: "border-cream/10 bg-cream/[0.04] text-muted hover:border-bronze/40 hover:text-bronze",
  danger: "border-red-300/30 bg-red-400/10 text-red-100 hover:bg-red-400/15"
};

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  asChildCompat,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  asChildCompat?: boolean;
}) {
  const buttonClassName = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-bronze/25 disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[variant],
    className
  );

  if (asChildCompat) {
    if (isValidElement<{ className?: string }>(children)) {
      return cloneElement(children, {
        className: cn(buttonClassName, children.props.className)
      });
    }

    return (
      <span className={buttonClassName}>{children}</span>
    );
  }

  return (
    <button
      type={type}
      className={buttonClassName}
      {...props}
    >
      {children}
    </button>
  );
}
