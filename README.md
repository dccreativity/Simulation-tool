# Quadrat &amp; Transect Lab

A browser simulation of the two sampling methods biology and environmental science
students are taught for measuring the **distribution** and **abundance** of organisms:
**random quadrats** and **transects**.

The point of the tool is the thing real fieldwork can never offer: the habitat has a
known, fixed population, so a student can sample it, scale their sample up to a
population estimate, and then see exactly how far off they were — and why.

No build step, no dependencies, no network calls. Open `index.html` and it runs.

## What it does

**A generated habitat with a real population.** Each of the five habitats is built from
density and cover functions over a 20 m × 20 m site. Countable species are generated as
individuals; carpet species (grass, moss, seaweed) as a cover field realised in plant
units. Everything comes from the site code typed into the page, so a whole class
entering `HEDGE-07` samples the identical site.

| Habitat | What it teaches |
| --- | --- |
| Oak tree in a meadow | Grass thins in shade, moss replaces it — a gradient running outward from the trunk |
| Footpath across a field | The classic transect: bare path, plantain on the trampled edge, daisies in short turf |
| Rocky shore, low to high water | Zonation — three wracks in bands, with limpets grazing the mid and lower shore |
| Mown lawn | A control with no gradient and no clumping: does random sampling recover the truth? |
| Thistles in rough grassland | A strongly clumped species, where ten quadrats are nowhere near enough |

**Three ways to place a quadrat.**

- *Random quadrats* — two tape measures at right angles, a random number generator for
  the coordinates, the frame's bottom-left corner on the pair it produces.
- *Belt transect* — quadrats at fixed intervals along a line (an interrupted belt
  transect), which is systematic sampling, not random.
- *My own spots* — click wherever looks interesting. This is the wrong method, included
  so the bias it produces can be measured rather than just asserted.

**Recording by hand.** The frame is strung into a 5 × 5 grid, so each small square is 4%.
Click individuals to tick them off, or click the small squares a species more than half
fills. *Check my count* compares your answer with the frame's real contents, including
what the half-square rule gives versus the true cover. An auto-fill button exists for
demonstrating and for getting quickly to the analysis.

**The arithmetic, shown.** Mean per quadrat, the number of quadrats in the site, the
population estimate, standard deviation, species richness, Simpson's index of diversity,
and the ACFOR band on the shore. Every step is written out with the numbers substituted,
not just the answer.

**Charts.** Spread between quadrats, the running estimate as quadrats accumulate,
abundance against distance along the transect, and a kite diagram.

**An Investigate tab** that repeats the entire survey 300 times at every sample size
from 1 to 30 quadrats, for three placement strategies, and reports how many quadrats it
actually takes to land within 10% of the truth — and that choosing by eye narrows in on
the *wrong* answer.

## Is the simulation honest?

It is only worth using if sampling it gives the same answers that sampling a real
population would, so two things were checked rather than assumed:

- **The estimator is unbiased.** The possible quadrat positions tile the site exactly, so
  every organism belongs to one and only one possible quadrat. Summing the true count
  over all 1,600 positions of a 0.5 m frame returns the population exactly, and 4,000
  simulated 10-quadrat surveys recover the true value to within Monte Carlo error for
  every species in every habitat. (Reading whole-metre coordinates with a half-metre
  frame would have made half of every metre strip unsamplable — hence the coordinates
  are read in frame-widths, which is also why a 1 m frame gives the whole numbers of
  the textbook method.)
- **The cover that is drawn is the cover that is measured.** Percentage cover is measured
  off the plant units actually rendered inside the frame, not from the function that
  generated them. Because union cover of overlapping discs depends on E[r²] rather than
  E[r]², the unit density is corrected for the spread of plant sizes; without that
  correction measured cover ran about 2.6% high.

Species colours are drawn from a palette validated for colour-blind separation in both
light and dark themes, and each species also carries its own glyph, so identity never
rests on colour alone.

## Files

```
index.html             the page
styles.css             tokens and layout, light and dark
js/rng.js              seeded randomness, Poisson deviates, value noise
js/scenarios.js        the five habitats: density and cover functions per species
js/site.js             generates the habitat and measures the truth inside a quadrat
js/render.js           site map with tape measures, quadrat close-up, glyphs
js/charts.js           SVG charts
js/app.js              state, interaction, calculations
tools/build-artifact.js strips the standalone wrapper for publishing as an Artifact
```

## Running it

Open `index.html` directly, or serve the folder:

```sh
npx http-server -p 8099 .
```

A static host works as-is — there is no server side. The only external request is the
Google Fonts stylesheet; the page falls back to system fonts without it.

## Notes for teaching

- The record sheet exports as CSV for a spreadsheet or lab book, and the page has a
  print stylesheet that drops the controls and keeps the sheet.
- *Reveal the true values* is a teacher switch: it shows the answer in the tally, the
  record sheet and the charts.
- The lawn habitat is the one to start with for "does random sampling work?", and the
  thistle habitat for "how many quadrats do we need?".
- On the lawn, a transect correctly shows a flat profile. That is the lesson, not a bug:
  with no gradient there is nothing for a transect to find, so use random quadrats.
