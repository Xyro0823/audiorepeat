'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { BarChart3, Bug, CircleHelp, Crown, Download, FileText, LogOut, Megaphone, Palette, Settings, ShieldCheck, UserRound, X } from 'lucide-react';
import useDialogA11y from '@/hooks/useDialogA11y';
import { useAuth } from '@/hooks/useAuth';
import InstallAppButton from '@/components/pwa/InstallAppButton';

const itemClass = 'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan';

/** Mobile-only secondary navigation. Primary daily actions remain in the dock. */
export default function MobileMenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialogA11y<HTMLElement>(open, onClose);
  const { status, user, logout } = useAuth();
  const name = status === 'signed-in' && user ? user.username : 'AudioRepeat хэрэглэгч';

  if (!open || typeof document === 'undefined') return null;
  // Keep the drawer outside route layouts.  A wide child in a page must never
  // move a fixed mobile menu sideways (Safari is especially sensitive to this).
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-x-clip md:hidden">
      <button type="button" aria-label="Цэс хаах" className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-label="Цэс" tabIndex={-1} className="absolute inset-y-0 left-0 flex w-[min(19rem,calc(100dvw-2rem))] max-w-[calc(100dvw-2rem)] flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-r border-white/10 bg-[#11141d] p-3 shadow-[24px_0_64px_rgba(0,0,0,0.48)]">
        <div className="flex items-center justify-between">
          <span className="px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Ажлын талбар</span>
          <button type="button" onClick={onClose} aria-label="Цэс хаах" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-2 space-y-1" aria-label="Нэмэлт цэс">
          <Link href="/checkout" onClick={onClose} className={itemClass}><Crown className="h-5 w-5 text-slate-300" />Төлөвлөгөө</Link>
          <Link href="/account/personalization" onClick={onClose} className={itemClass}><Palette className="h-5 w-5 text-slate-300" />Хувийн тохируулга</Link>
          <Link href="/account" onClick={onClose} className={itemClass}><UserRound className="h-5 w-5 text-slate-300" />Профайл</Link>
          <Link href="/stats" onClick={onClose} className={itemClass}><BarChart3 className="h-5 w-5 text-slate-300" />Статистик</Link>
          <Link href="/settings" onClick={onClose} className={itemClass}><Settings className="h-5 w-5 text-slate-300" />Тохиргоо</Link>
          <div className="my-3 border-t border-white/10" />
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Тусламж</p>
          <Link href="/help" onClick={onClose} className={itemClass}><CircleHelp className="h-5 w-5 text-slate-300" />Тусламжийн төв</Link>
          <Link href="/help/release-notes" onClick={onClose} className={itemClass}><Megaphone className="h-5 w-5 text-slate-300" />Шинэчлэлийн тэмдэглэл</Link>
          <Link href="/help/download-apps" onClick={onClose} className={itemClass}><Download className="h-5 w-5 text-slate-300" />Апп татах</Link>
          <div className="my-3 border-t border-white/10" />
          <Link href="/terms" onClick={onClose} className={itemClass}><FileText className="h-5 w-5 text-slate-300" />Үйлчилгээний нөхцөл</Link>
          <Link href="/privacy" onClick={onClose} className={itemClass}><ShieldCheck className="h-5 w-5 text-slate-300" />Нууцлалын бодлого</Link>
          <Link href="/help/report-bug" onClick={onClose} className={itemClass}><Bug className="h-5 w-5 text-slate-300" />Алдаа мэдээлэх</Link>
        </nav>
        <div className="mt-auto border-t border-white/10 pt-3">
          <div className="mb-1 flex items-center gap-2">
            <Link href="/account" onClick={onClose} className={`${itemClass} min-w-0 flex-1`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">{name}</span>
                <span className="block truncate text-[11px] font-normal text-slate-500">{user?.email ?? 'Бүртгэл'}</span>
              </span>
            </Link>
            <InstallAppButton variant="sidebar" />
          </div>
          <button type="button" onClick={() => { onClose(); void logout(); }} className={`${itemClass} w-full text-left text-rose-300`}><LogOut className="h-5 w-5" />Гарах</button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
