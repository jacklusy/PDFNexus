import { SiteFooter } from '@/components/SiteChrome';
import { AdSlot } from '@/shared/ui';
import { MarketingHero } from '@/features/workspace/MarketingHero';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingHero />

      <section className="atmosphere-light px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl text-[color:var(--color-ink)]">
            Built for private, high-fidelity assembly
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-muted)]">
            Source files never leave your browser during merge and organize. Final PDFs and Word
            exports are uploaded only after verification for download and email delivery.
          </p>
        </div>
        <div className="mt-12">
          <AdSlot slotId="home-below-fold" height={90} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
