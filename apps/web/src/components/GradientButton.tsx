import React from "react";
import { Loader2 } from "lucide-react";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
}

export function GradientButton({ isLoading, children, className = "", ...props }: GradientButtonProps) {
  return (
    <button
      disabled={isLoading || props.disabled}
      className={`relative w-full bg-gradient-primary text-white py-3 px-4 rounded-xl font-semibold overflow-hidden transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed group ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      {/* Subtle animated glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-30 blur-lg transition-opacity duration-500 rounded-xl"></div>
      
      <div className="relative flex items-center justify-center gap-2">
        {isLoading && <Loader2 size={18} className="animate-spin" />}
        {children}
      </div>
    </button>
  );
}
