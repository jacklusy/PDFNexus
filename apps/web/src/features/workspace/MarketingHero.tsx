'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteChrome';

export function MarketingHero() {
  return (
    <section className="atmosphere relative min-h-[100svh] overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl"
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-20 h-80 w-80 rounded-full bg-slate-100/10 blur-3xl"
        animate={{ opacity: [0.2, 0.4, 0.2], y: [0, -18, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <SiteHeader variant="dark" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-5.5rem)] max-w-5xl flex-col items-start justify-center px-6 pb-24 pt-10 md:px-10">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-5xl tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          PDFNexus
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08 }}
          className="mt-6 max-w-2xl text-2xl font-semibold leading-snug text-teal-50/95 sm:text-3xl"
        >
          Merge and organize PDFs on your device.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.16 }}
          className="mt-4 max-w-xl text-base leading-relaxed text-teal-100/80 sm:text-lg"
        >
          Reorder, rotate, and assemble pages locally — finished PDFs download
          immediately. Email verification and Drive are optional extras.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.24 }}
          className="mt-10"
        >
          <Link
            href="/workspace"
            className="group inline-flex items-center gap-2 rounded-2xl bg-teal-300 px-6 py-3.5 text-sm font-bold text-teal-950 shadow-lg shadow-teal-950/30 transition hover:bg-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Open workspace
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
