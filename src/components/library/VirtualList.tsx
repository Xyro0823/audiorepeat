'use client';

import { useState, type ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
  overscan?: number;
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
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const total = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const visible = [];
  for (let i = start; i < end; i += 1) visible.push(i);

  return (
    <div
      className={`overflow-y-auto ${className}`}
      style={{ height }}
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
