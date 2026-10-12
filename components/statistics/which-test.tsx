'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface Answer {
  tool: string;
  path: string[];
  why: string;
  href: string;
  cta: string;
}

interface Question {
  prompt: string;
  options: { label: string; hint?: string; next: Question | Answer }[];
}

const isAnswer = (x: Question | Answer): x is Answer => 'tool' in x;

const TREE: Question = {
  prompt: 'What are you trying to investigate?',
  options: [
    {
      label: 'The typical value of one set of data',
      hint: 'e.g. how many daisies are in a quadrat on average?',
      next: {
        prompt: 'What kind of data do you have?',
        options: [
          {
            label: 'Numbers, fairly symmetrical, no extreme values',
            next: {
              tool: 'Mean',
              path: ['One set of numbers', 'Typical value', 'Symmetrical data', 'Mean'],
              why: 'The mean uses every value, so it is the most informative average when no extreme values distort it.',
              href: '/statistics',
              cta: 'Calculate the mean',
            },
          },
          {
            label: 'Numbers with a few very high or low values (skewed)',
            next: {
              tool: 'Median',
              path: ['One set of numbers', 'Typical value', 'Skewed / outliers', 'Median'],
              why: 'The median is the middle value, so a few extreme values barely move it. Clumped ecological counts are often skewed.',
              href: '/statistics',
              cta: 'Calculate the median',
            },
          },
          {
            label: 'Categories, or the most common value',
            next: {
              tool: 'Mode',
              path: ['One set of data', 'Most common value', 'Mode'],
              why: 'The mode is the only average that works for categories (e.g. the most frequent species) and shows the commonest count.',
              href: '/statistics',
              cta: 'Find the mode',
            },
          },
        ],
      },
    },
    {
      label: 'How spread out or variable my data are',
      hint: 'e.g. are counts similar in every quadrat, or very different?',
      next: {
        prompt: 'Do you want a quick summary or a measure that uses every value?',
        options: [
          {
            label: 'A measure that uses every value',
            next: {
              tool: 'Standard deviation',
              path: ['One set of numbers', 'Spread', 'Uses every value', 'Standard deviation'],
              why: 'The standard deviation measures the typical distance of values from the mean. It is also what a t-test uses to judge uncertainty.',
              href: '/statistics',
              cta: 'Explore standard deviation',
            },
          },
          {
            label: 'Just the smallest to largest',
            next: {
              tool: 'Range',
              path: ['One set of numbers', 'Spread', 'Quick summary', 'Range'],
              why: 'The range is easy to find, but it depends on only two values, so one unusual sample changes it a lot. Report it alongside the SD.',
              href: '/statistics',
              cta: 'Find the range',
            },
          },
        ],
      },
    },
    {
      label: 'Whether two groups are different',
      hint: 'e.g. daisies on the path vs in the meadow',
      next: {
        prompt: 'What have you recorded for each group?',
        options: [
          {
            label: 'Numbers for each sample (counts or measurements)',
            next: {
              prompt: 'Are the two groups independent?',
              options: [
                {
                  label: 'Yes — different quadrats, individuals or sites',
                  next: {
                    tool: 't-test (independent samples)',
                    path: ['Two numerical datasets', 'Comparing means', 'Independent groups', 't-test'],
                    why: 'A t-test asks whether the difference between two sample means is larger than you would expect from sampling variation alone.',
                    href: '/statistics/t-test',
                    cta: 'Run a t-test',
                  },
                },
                {
                  label: 'No — the same individuals measured twice',
                  next: {
                    tool: 'Paired t-test',
                    path: ['Two numerical datasets', 'Comparing means', 'Paired measurements', 'Paired t-test'],
                    why: 'Paired data need a paired t-test, which works on the differences within each pair. This lab covers independent samples; calculate the differences and describe them in the Statistics Lab.',
                    href: '/statistics',
                    cta: 'Describe the differences',
                  },
                },
              ],
            },
          },
          {
            label: 'How many fall into each category',
            next: {
              tool: 'Chi-squared test of association',
              path: ['Counts in categories', 'Two variables', 'Association', 'Chi-squared'],
              why: 'When each observation falls into categories (present/absent, zone A/zone B), a chi-squared test checks whether the categories are linked.',
              href: '/statistics/chi-squared?mode=association',
              cta: 'Test an association',
            },
          },
        ],
      },
    },
    {
      label: 'Whether observed counts match what I expected',
      hint: 'e.g. a 3 : 1 ratio, or equal numbers on each side of a choice chamber',
      next: {
        tool: 'Chi-squared goodness of fit',
        path: ['Counts in categories', 'Expected frequencies', 'Observed vs expected', 'Chi-squared'],
        why: 'Chi-squared compares observed frequencies with the frequencies your null hypothesis predicts. It must be used on raw counts, not percentages or means.',
        href: '/statistics/chi-squared',
        cta: 'Run a chi-squared test',
      },
    },
    {
      label: 'Whether two species are found together',
      hint: 'e.g. is buttercup found in the same quadrats as clover?',
      next: {
        tool: 'Chi-squared test of association',
        path: ['Presence / absence in quadrats', 'Two species', 'Association', 'Chi-squared'],
        why: 'Classify every quadrat by whether each species is present. If the species were independent, the counts would follow the expected frequencies.',
        href: '/statistics/chi-squared?mode=association',
        cta: 'Test species association',
      },
    },
  ],
};

export function WhichTest() {
  const [trail, setTrail] = useState<{ q: Question; choice: number }[]>([]);
  const current: Question | Answer = trail.reduce<Question | Answer>((node, step) => (isAnswer(node) ? node : node.options[step.choice].next), TREE);
  const questions: Question[] = [TREE];
  trail.forEach((step, i) => {
    const next = questions[i].options[step.choice].next;
    if (!isAnswer(next)) questions.push(next);
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        {questions.map((q, qi) => {
          const chosen = trail[qi]?.choice;
          return (
            <motion.div key={`${qi}-${q.prompt}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-5">
                <fieldset>
                  <legend className="mb-3 text-base font-semibold text-ink">{q.prompt}</legend>
                  <div className="flex flex-col gap-2">
                    {q.options.map((o, oi) => (
                      <button
                        key={o.label}
                        type="button"
                        aria-pressed={chosen === oi}
                        onClick={() => setTrail([...trail.slice(0, qi), { q, choice: oi }])}
                        className={cn(
                          'flex flex-col rounded-2xl border px-4 py-3 text-left transition-colors',
                          chosen === oi ? 'border-teal-600 bg-teal-50' : 'border-line bg-paper hover:border-teal/50',
                          chosen !== undefined && chosen !== oi && 'opacity-60',
                        )}
                      >
                        <span className="text-sm font-medium text-ink">{o.label}</span>
                        {o.hint && <span className="text-xs text-ink-3">{o.hint}</span>}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <AnimatePresence mode="wait">
          {isAnswer(current) ? (
            <motion.div key={current.tool} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className="overflow-hidden">
                <div className="on-dark bg-navy px-5 py-4 text-cream">
                  <p className="text-xs tracking-[0.16em] text-pale uppercase">Your reasoning</p>
                  <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {current.path.map((p, i) => (
                      <motion.li key={p} className="flex items-center gap-2" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.25 }}>
                        {i > 0 && <ArrowRight className="size-3.5 text-sage" aria-hidden />}
                        <span className={i === current.path.length - 1 ? 'font-semibold text-cream' : 'text-pale'}>{p}</span>
                      </motion.li>
                    ))}
                  </ol>
                </div>
                <motion.div className="flex flex-col gap-3 p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: current.path.length * 0.25 }}>
                  <p className="text-xs tracking-[0.16em] text-ink-3 uppercase">Use</p>
                  <p className="text-2xl font-semibold text-ink">{current.tool}</p>
                  <p className="text-sm leading-relaxed text-ink-2">{current.why}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <ButtonLink href={current.href} iconRight={<ArrowRight className="size-4" aria-hidden />}>
                      {current.cta}
                    </ButtonLink>
                    <Button variant="ghost" onClick={() => setTrail([])} icon={<RotateCcw className="size-4" aria-hidden />}>
                      Start again
                    </Button>
                  </div>
                </motion.div>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-5">
                <p className="text-xs tracking-[0.16em] text-ink-3 uppercase">Reasoning pathway</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  Answer the questions and the pathway builds up here. Statistics start with the question you are asking — the right test follows from the kind of data you
                  have and what you want to know.
                </p>
                {trail.length > 0 && (
                  <Button className="mt-4" size="sm" variant="ghost" onClick={() => setTrail([])} icon={<RotateCcw className="size-4" aria-hidden />}>
                    Start again
                  </Button>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
