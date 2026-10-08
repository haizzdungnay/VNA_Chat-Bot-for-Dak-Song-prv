---
name: Highland Nocturne Eco-Tourism
colors:
  surface: '#0f1511'
  surface-dim: '#0f1511'
  surface-bright: '#343b36'
  surface-container-lowest: '#0a100c'
  surface-container-low: '#171d19'
  surface-container: '#1b211d'
  surface-container-high: '#252b27'
  surface-container-highest: '#303632'
  on-surface: '#dee4dd'
  on-surface-variant: '#bec9c0'
  inverse-surface: '#dee4dd'
  inverse-on-surface: '#2c322d'
  outline: '#88938b'
  outline-variant: '#3f4942'
  surface-tint: '#80d8a9'
  primary: '#80d8a9'
  on-primary: '#003822'
  primary-container: '#49a175'
  on-primary-container: '#00311d'
  inverse-primary: '#006c46'
  secondary: '#90d797'
  on-secondary: '#003914'
  secondary-container: '#0b5524'
  on-secondary-container: '#83c88a'
  tertiary: '#f9bb68'
  on-tertiary: '#462b00'
  tertiary-container: '#bc8639'
  on-tertiary-container: '#3d2500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf5c3'
  primary-fixed-dim: '#80d8a9'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#005234'
  secondary-fixed: '#acf3b1'
  secondary-fixed-dim: '#90d797'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#075222'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#f9bb68'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#0f1511'
  on-background: '#dee4dd'
  surface-variant: '#303632'
typography:
  display-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style
The design system channels the atmospheric, moonlit wilderness of the Đắk Song pine hills and volcanic basalt ridges into a compact mobile-first experience. Tailored specifically for the Zalo Mini App ecosystem, the aesthetic fuses ecological reverence with contemporary tactical clarity: a "Deep Forest Bioluminescence" look that feels immersive, pristine, and effortless under thumb-reach constraints.

The visual style unites **Organic Tactility** with **Tonal Glassmorphism**:
- Deep obsidian-pine base layers deliver nocturnal immersion, preventing glare in low-light travel environments while conserving battery on mobile OLED displays.
- High-contrast pine canopy greens paired with glowing basalt ochre accents create high-legibility hierarchy for interactive hotspots, itineraries, audio guides, and AI assistant tags.
- Surface treatments evoke smooth polished volcanic stone bordered by subtle ambient moss lines, giving the interface structure without harsh artificial dividers.

## Colors
The palette captures the nocturnal microclimate of Đắk Song—cool misty winds, towering pine forests, red basalt earth veiled in dusk, and clear star-lit navigation.

### Palette Architecture
- **Canvas Base (`#121814`)**: Root canvas; deepest night forest black to anchor zero-elevation surfaces.
- **Surface Level 1 (`#18221C`)**: Structural backdrops, bottom sheets, navigation bars, and sticky top headers.
- **Surface Level 2 / Container (`#1E2B24`)**: Primary interactive card backgrounds, search inputs, list groupings.
- **Surface Level 3 / Highlight Surface (`#26362E`)**: Active pill selections, elevated chips, pressed states.
- **Subtle Contour / Borders (`#2E4037`)**: Translucent structural borders maintaining optical separation between nested dark tiers.
- **Primary Brand Accent (`#348E64` / Active `#44A877` / Dark `#2E7D58`)**: High-contrast Highland Forest Green reserved for primary actions, floating reserve buttons, interactive route pathways, and confirmed checkmarks.
- **Secondary Leaf Accent (`#65A96E`)**: Soft foliage green for badges, category tags, eco-certification markers, and active tab highlights.
- **Basalt Ochre Accent (`#DCA252` / Glow `#E7C37A`)**: Earthy amber-gold strictly deployed for rating stars, sunrise/sunset alerts, native cultural landmarks, and AI Travel Concierge indicators.
- **Primary Text (`#F0F4F1`)**: Crisp mist-tinted white with 94% opacity for maximum accessibility against dark grounds.
- **Secondary Text (`#9EB0A4`)**: Cool foliage grey with 70% opacity for subheads, timestamps, coordinates, and unselected metadata.

## Typography
The system uses **Be Vietnam Pro** across all typographic touchpoints. Chosen for its native typographic finesse with Vietnamese diacritics, geometric balance, and excellent legibility on compact handheld screens.

### Hierarchy & Tuning
- **Display & Headlines (`headline-lg-mobile`, `headline-md`)**: Crisp tracking with tight line heights to hold impactful destination names (e.g., "Thác Lưu Ly", "Đồi thông Đắk Song") without unwanted text wrapping on smaller devices.
- **Body Copies (`body-md`, `body-lg`)**: Carefully relaxed line-height (1.4–1.5x) to maintain clear readability through dark mode luminance bloom.
- **Labels & Micro-copy (`label-sm`, `label-md`)**: Enhanced tracking for capitalised badges, trail difficulty ratings, and distance meters.

## Layout & Spacing
Optimized specifically for the Zalo Mini App shell constraint (360px–430px core viewport width).

### Layout Rules
- **Base Rhythm**: 4px base stepping grid with standard 16px (`1rem`) lateral screen margins to maximize horizontal viewing space while respecting hardware roundings and safe areas.
- **Zalo Shell Safe Bounds**: Top margin compensates for custom Mini App navigation bars (`44px` header zone + dynamic status bar). Bottom padding includes `calc(env(safe-area-inset-bottom) + 16px)` to avoid gesture conflict.
- **Card Clustering**: Internal horizontal card flow uses `0.75rem` (`12px`) gaps between destination thumbnails and story bubbles.

## Elevation & Depth
Elevation in this deep forest environment relies on layered tonal illumination and spectral boundaries rather than traditional murky dropshadows.

### The Stack Model
- **Level 0 (Floor)**: `#121814` – Pure raw background.
- **Level 1 (Dock & Shelves)**: `#18221C` – Floating bottom booking bar, bottom sheets, top nav with `backdrop-filter: blur(16px)` and 85% opacity.
- **Level 2 (Active Cards & Panels)**: `#1E2B24` with a 1px continuous hairline outline using `#2E4037`.
- **Level 3 (Modals & Overlays)**: `#26362E` surrounded by a faint glowing halo: `0 8px 32px -4px rgba(18, 24, 20, 0.8), 0 0 1px 1px rgba(46, 64, 55, 0.6)`.

### Basalt & Forest Glow
- Interactive focal elements (e.g., the primary booking CTA or active route marker) receive a soft radial glow: `box-shadow: 0 4px 20px rgba(52, 142, 100, 0.28)`.
- AI Smart Assistant triggers receive an ambient ochre flare: `box-shadow: 0 4px 16px rgba(220, 162, 82, 0.24)`.

## Shapes
In accordance with the required spec, corner curves adhere to a tactile 16px–20px radii scale, matching modern mobile native standards and lending cards a smooth, river-stone silhouette.

- **Standard Cards & Modals**: `16px` to `20px` corner rounding (`rounded-lg` / `rounded-xl`).
- **Input Fields & Action Triggers**: `16px` inner rounding.
- **Chips, Category Pills & Quick Filters**: Full organic capsule shape (`9999px` / pill style).
- **Image Media Wrappers**: Matched to parent card contours with `16px` radius and hidden overflow.

## Components

### Buttons
- **Primary CTA**: Background `#348E64`, text `#F0F4F1` (`label-lg`), height 48px, border-radius 16px. Active tap scale down to 0.98 with background shift to `#44A877`. Optional soft emerald glow.
- **Secondary Action**: Background `#1E2B24`, border 1px solid `#2E4037`, text `#F0F4F1`. Active state shifts surface to `#26362E`.
- **AI Assist / Special CTA**: Gradient background from `#DCA252` to `#C78E3F`, dark charcoal text `#121814`, accompanied by warm luminescence.

### Chips & Filter Pills
- **Resting**: Background `#18221C`, border 1px solid `#2E4037`, text `#9EB0A4`, height 32px, padding 0 14px, rounded-full.
- **Active**: Background `#26362E`, border 1px solid `#65A96E`, text `#F0F4F1`, bold text weight with secondary leaf dot indicator.

### Cards
- **Destination & Tour Cards**: Surface `#1E2B24`, border 1px solid `#2E4037`, border-radius 18px, content padding 16px. Top image aspect ratio 16:10 with smooth bottom vignette gradient fading into `#1E2B24`.
- **Weather & Forest Status Card**: Compact banner styling with subtle forest mist backdrop blur, displaying elevation, humidity, and eco-condition with `#65A96E` metrics.

### Input Fields & Search
- Container `#1E2B24`, border 1px solid `#2E4037`, border-radius 16px, min-height 48px, text `#F0F4F1`, placeholder `#9EB0A4`.
- Focus state: Border illuminates to `#348E64` with no harsh outline ring.

### Lists & Cell Groups
- Clean dividers with 1px inset lines of `#2E4037` with 50% opacity. Chevron glyphs rendered in muted `#9EB0A4`.

### Badges & Micro-tags
- **Eco-Heritage Tag**: Pill badge with background `rgba(101, 169, 110, 0.15)`, text `#65A96E`, border 1px solid `rgba(101, 169, 110, 0.3)`.
- **AI Recommendation / Basalt Highlight**: Pill badge with background `rgba(220, 162, 82, 0.15)`, text `#E7C37A`, border 1px solid `rgba(220, 162, 82, 0.35)`.