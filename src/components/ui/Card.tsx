import type { ReactNode, HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  noPadding?: boolean;
}

export default function Card({ children, className, noPadding, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-gray-200 shadow-card",
        !noPadding && "p-5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
