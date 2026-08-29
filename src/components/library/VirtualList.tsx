'use client';

import { useState, type ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
  overscan?: number;
  /** Keep preview lists usable inside short mobile dialogs. */
  responsiveHeight?: boolean;
  /** Fill the remaining height of a flex preview pane. */
  fillAvailableHeight?: boolean;
}

/**
 * Minimal fixed-height virtualizer — renders only the visible window plus
 * overscan, so lists with thousands of rows stay smooth without extra deps.
 */
export default function VirtualList<T>({
  items,
  height,
  rowHeight,
  renderRow,
  className = '',
  overscan = 8,
  responsiveHeight = false,
  fillAvailableHeight = false,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const total = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const visible = [];
  for (let i = start; i < end; i += 1) visible.push(i);

  return (
    <div
      className={`touch-pan-y overflow-y-auto overscroll-contain ${className}`}
      style={{
        height: fillAvailableHeight ? '100%' : responsiveHeight ? `min(${height}px, 28dvh)` : height,
        ...(fillAvailableHeight ? { flex: '1 1 0%', minHeight: 0 } : {}),
      }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: total, position: 'relative' }}>
        {visible.map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: i * rowHeight,
              left: 0,
              right: 0,
              height: rowHeight,
            }}
          >
            {renderRow(items[i], i)}
          </div>
        ))}
      </div>
    </div>
  );
}
