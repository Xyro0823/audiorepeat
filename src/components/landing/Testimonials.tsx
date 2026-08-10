import { Star } from "lucide-react";
import { TESTIMONIALS } from "@/lib/testimonials";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`h-3.5 w-3.5 ${
            i <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-600"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * "Loved by learners" — social proof section. Renders the (placeholder) data
 * from @/lib/testimonials; swap that file's contents for real, moderated
 * reviews before launch.
 */
export default function Testimonials() {
  return (
    <section id="testimonials" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">
          Loved by learners
        </p>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
          What learners are saying
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
          Real routines, real progress — from commutes to bedtime loops.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="glass-neural flex flex-col rounded-3xl p-6 transition hover:-translate-y-1 hover:border-cyan-400/40"
          >
            <Stars rating={t.rating} />
            <blockquote className="mt-4 flex-1">
              <p className="text-sm leading-relaxed text-slate-300">&ldquo;{t.quote}&rdquo;</p>
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${t.avatarGrad}`}
              >
                {t.name.charAt(0)}
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-slate-500">
                  Learning {t.language} · {t.duration}
                </div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
