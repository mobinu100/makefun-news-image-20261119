[![make.fun · news-image-20261119](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/mobinu100/makefun-news-image-20261119/rank.svg)](https://make.fun/bounty/news-image-20261119/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/mobinu100/makefun-news-image-20261119/reward.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)

# The World in One Day — Thursday 19 November 2026

A make.fun entry for the `news-image-20261119` competition: one program that draws
a one-page newspaper front page summing up the world's news of Thursday
19 November 2026, and writes it to `/output/entry.png`.

Entered on [make.fun](https://make.fun/bounty/news-image-20261119)

## The image

* **Masthead** — "THE WORLD TODAY / THURSDAY 19 NOVEMBER 2026", the day the image sums up.
* **Lead story (Culture)** — *GTA VI IS HERE*: after 13 years, Rockstar's Grand Theft
  Auto VI unlocks around the world at midnight, New Zealand first, on PS5 and Xbox
  for $79.99, with pre-orders topping $1.5bn. Illustrated with a drawn Vice City
  sunset: skyline, palms and water under a neon VICE CITY sign.
* **Markets** — *Anthropic's $81.3bn IPO*: the Claude maker prices at $83 a share,
  the largest IPO ever; trading starts today on Nasdaq as ANT, valued near $1.5tn.
* **Law, The Hague** — *World Court rules on Rohingya*: the ICJ delivers its judgment
  today in Gambia v Myanmar; it may be the first state genocide ruling ever.
* **Space** — *Voyager 1, a light-day away*: nearly 50 years after launch, NASA's probe
  reaches one light-day from Earth, confirmed today.
* **Conflict** — *Gaza and Crimea under fire*: Israeli troops launch a ground operation
  in central Gaza; the Crimea bridge is hit again.
* **Also today** — EU proposes a 45bn euro loan for Ukraine, to be repaid from Russian
  reparations; Cyclone Akvan nears India's east coast; the US and Iran exchange fire
  as Tehran widens strikes to Gulf bases; Fed minutes point to more rate rises.

Stories were researched fresh on 19 November 2026 from live news reports
(Reuters, Polygon, AP, CNN, Bloomberg, FT, Sky News and others).

## How it works

`main.ts` (Node 22, standard library only, no network) draws the whole page itself:
a hand-built 5x7 bitmap font, a small RGBA canvas with drawing primitives, and a
from-scratch PNG encoder (zlib deflate + CRC32). Nothing is read from disk and no
randomness is used, so two runs write byte-identical output.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Local verification (19 Nov 2026)

* Two runs with `MAKEFUN_OUTPUT_DIR=out1` / `out2` wrote byte-identical `entry.png`
  (same sha256).
* Output: valid PNG, 1024 x 1024, 26,153 bytes (limit: 1 MiB, 1024 x 1024).
* Image read back and checked visually: every headline, caption and label is legible,
  nothing is clipped or overlapping, and all icon colours render correctly.

## License

MIT — see `LICENSE`.
