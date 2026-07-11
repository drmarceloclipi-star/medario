import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className="mdr-button"
      data-variant={variant}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Carregando…" : children}
    </button>
  );
}

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, children, ...props }: IconButtonProps) {
  return (
    <button className="mdr-icon-button" aria-label={label} {...props}>
      {children}
    </button>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  return <input className="mdr-input" {...props} />;
}

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`mdr-card ${className}`.trim()} {...props} />;
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected = false, ...props }: ChipProps) {
  return (
    <button
      className="mdr-chip"
      type="button"
      aria-pressed={selected}
      {...props}
    />
  );
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge(props: BadgeProps) {
  return <span className="mdr-badge" {...props} />;
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  fallback: ReactNode;
  imageProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;
}

export function Avatar({
  src,
  alt = "",
  fallback,
  imageProps,
  ...props
}: AvatarProps) {
  return (
    <span className="mdr-avatar" {...props}>
      {src ? <img src={src} alt={alt} {...imageProps} /> : fallback}
    </span>
  );
}
