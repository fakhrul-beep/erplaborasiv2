import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "h-12" }: LogoProps) {
  return (
    <img 
      src="/logo.png" 
      alt="Ternakmart" 
      className={`object-contain ${className}`}
    />
  );
}
