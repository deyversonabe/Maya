import { cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-terracotta/80 bg-gradient-to-br from-terracotta via-bronze to-[#7d3d2b] text-cream shadow-lg shadow-terracotta/25 hover:border-neon-amber hover:shadow-neon hover:brightness-110",
  secondary:
    "border-neon-cyan/30 bg-neon-cyan/10 text-cyan-100 shadow-neon hover:border-bronze hover:bg-bronze/15 hover:text-bronze",
  ghost: "border-cream/10 bg-cream/[0.04] text-muted hover:border-neon-cyan/40 hover:bg-neon-cyan/10 hover:text-cyan-100",
  danger: "border-alert-red/40 bg-alert-red/10 text-red-100 shadow-neon-red hover:bg-alert-red/15"
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
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition duration-200 focus:outline-none focus:ring-4 focus:ring-neon-cyan/25 disabled:cursor-not-allowed disabled:opacity-50",
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
