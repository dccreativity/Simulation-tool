'use client';

import { motion } from 'framer-motion';
import { ChartColumn, ChevronRight, CircleHelp, FileText, FlaskConical, MapPin, PencilRuler } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';

const STEPS = [
  { n: 1, title: 'Question', text: 'Read the problem', icon: CircleHelp, href: '/simulation' },
  { n: 2, title: 'Design', text: 'Choose a method', icon: PencilRuler, href: '/simulation' },
  { n: 3, title: 'Collect', text: 'Take samples', icon: MapPin, href: '/simulation' },
  { n: 4, title: 'Analyse', text: 'Calculate statistics', icon: ChartColumn, href: '/statistics' },
  { n: 5, title: 'Test', text: 't-test or χ²', icon: FlaskConical, href: '/statistics/which-test' },
  { n: 6, title: 'Conclude', text: 'Interpret results', icon: FileText, href: '/notebook' },
];

/** QUESTION → DESIGN → COLLECT → ANALYSE → TEST → CONCLUDE */
export function InvestigationJourney({ compact = false }: { compact?: boolean }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:items-stretch lg:gap-0">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <Fragment key={s.n}>
            <motion.li
              className="lg:flex-1"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Link
                href={s.href}
                className="flex h-full flex-col items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-teal/50 hover:shadow-card"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-ink">
                  {s.n}. {s.title}
                </span>
                {!compact && <span className="text-xs text-ink-3">{s.text}</span>}
              </Link>
            </motion.li>
            {i < STEPS.length - 1 && (
              <li aria-hidden className="hidden items-center px-1.5 text-teal lg:flex">
                <ChevronRight className="size-4" />
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
