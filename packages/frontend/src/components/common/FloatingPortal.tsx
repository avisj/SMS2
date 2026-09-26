// ========================================================================
// FloatingPortal Component
// Teleports floating menus (BranchSelector, UserMenu, 1/10 Switcher) to document.body
// Enforces Layer 4 z-index (z-[200]), boundary collision detection, and zero container clipping
// ========================================================================

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface FloatingPortalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number;
  className?: string;
  placement?: 'bottom-end' | 'bottom-start';
}

export const FloatingPortal: React.FC<FloatingPortalProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  width = 240,
  className = '',
  placement = 'bottom-end',
}) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Use actual rendered height if available, or sensible estimate
    const measuredHeight = portalRef.current?.offsetHeight || 260;

    let top = rect.bottom + 6;
    // Bottom viewport boundary collision: flip above if overflowing below
    if (top + measuredHeight > viewportHeight - 10) {
      const aboveTop = rect.top - measuredHeight - 6;
      if (aboveTop >= 10 || rect.top > viewportHeight - rect.bottom) {
        top = Math.max(10, aboveTop);
      }
    }

    // Horizontal placement
    let left = placement === 'bottom-end' ? rect.right - width : rect.left;

    // Right and left viewport boundary collisions
    if (left + width > viewportWidth - 10) {
      left = viewportWidth - width - 10;
    }
    if (left < 10) {
      left = 10;
    }

    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      const animFrame = requestAnimationFrame(() => {
        updatePosition();
      });
      return () => cancelAnimationFrame(animFrame);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        portalRef.current &&
        !portalRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !coords) return null;

  return createPortal(
    <div
      ref={portalRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width,
        zIndex: 200,
      }}
      className={`rounded-xl bg-white border border-slate-200 shadow-2xl ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};
