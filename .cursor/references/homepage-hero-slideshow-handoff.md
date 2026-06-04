# Homepage hero → slideshow handoff

- `templates/index.json`: `slideshow_yKeNaA` mirrors `hero_jVaWmY` (single `_slide`, same copy/CTA/images). Hero stays above until removed.
- `blocks/_slide.liquid`: `custom_mobile_media` + `image_1_mobile`; cover via `.slide__image-container :is(.slide__image, …)`.
- `sections/slideshow.liquid`: `custom_class` (e.g. `torineser-home-slideshow`).
- **Text spacing**: `.slide__content > .group-block-content` uses `max-width: min(var(--normal-page-width), calc(100% - var(--page-margin) * 2))`, `margin-inline: auto`, plus hero `padding-inline` (48 / 32 / 22px). No grid.
