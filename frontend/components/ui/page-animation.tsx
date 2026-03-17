'use client';

import { useEffect, useState, ReactNode } from 'react';

interface PageAnimationProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function PageAnimation({ children, delay = 0, className = '' }: PageAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`animate-fade-in-up ${className}`}
      style={{ opacity: isVisible ? undefined : 0 }}
    >
      {children}
    </div>
  );
}

interface StaggeredGridProps {
  children: ReactNode[];
  delay?: number;
  className?: string;
}

export function StaggeredGrid({ children, delay = 75, className = '' }: StaggeredGridProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className="animate-fade-in-up"
          style={{ animationDelay: `${index * delay}ms`, opacity: 0 }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

interface CardAnimationProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function CardAnimation({ children, delay = 0, className = '' }: CardAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`card-hover animate-scale-in ${className}`}
      style={{ opacity: isVisible ? undefined : 0 }}
    >
      {children}
    </div>
  );
}
