---
name: Eco Highlands Tourism
colors:
  surface: '#f8faf7'
  surface-dim: '#d8dbd8'
  surface-bright: '#f8faf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f1'
  surface-container: '#eceeeb'
  surface-container-high: '#e7e9e6'
  surface-container-highest: '#e1e3e0'
  on-surface: '#191c1b'
  on-surface-variant: '#404943'
  inverse-surface: '#2e312f'
  inverse-on-surface: '#eff1ee'
  outline: '#707972'
  outline-variant: '#bfc9c1'
  surface-tint: '#2d694d'
  primary: '#00452d'
  on-primary: '#ffffff'
  primary-container: '#1f5d42'
  on-primary-container: '#95d4b1'
  inverse-primary: '#95d4b2'
  secondary: '#286b37'
  on-secondary: '#ffffff'
  secondary-container: '#a9f1af'
  on-secondary-container: '#2c6f3b'
  tertiary: '#563400'
  on-tertiary: '#ffffff'
  tertiary-container: '#754900'
  on-tertiary-container: '#fcba65'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b1f0cd'
  primary-fixed-dim: '#95d4b2'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#0f5137'
  secondary-fixed: '#acf3b1'
  secondary-fixed-dim: '#90d797'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#075222'
  tertiary-fixed: '#ffddb7'
  tertiary-fixed-dim: '#fcba65'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8faf7'
  on-background: '#191c1b'
  surface-variant: '#e1e3e0'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
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
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system expresses an **Eco Modern** aesthetic harmonized with the indigenous character of the Central Highlands (Đắk Song, Đắk Nông) and modern digital convenience tailored for a Zalo Mini App runtime. 

The aesthetic marries organic warmth—evoking pine-forested ridgelines, fertile red basalt soils, and expansive pepper and coffee plantations—with clean, high-precision modern app structures and lightweight, non-intrusive AI travel-assistance cues. 

### Core Attributes
- **Calm & Forested:** Clean surfaces anchored by deep canopy green, rejecting noisy gradients in favor of earthy authenticity.
- **Culturally Grounded:** Ochre and volcanic soil tones highlight indigenous agricultural heritage without looking antiquarian.
- **Intelligently Light:** AI itinerary planning and smart suggestions are integrated as gentle, ambient recommendations using warm amber accents rather than futuristic neon effects.
- **Frictionless Mobile Utility:** Designed for native performance within the compact Zalo Mini App webview environment (optimized for 390px base viewport), prioritizing high readability and rapid thumb ergonomics.

## Colors

The palette directly references the microclimate and topography of Đắk Song: dense pine belts, vibrant foliage, and sunlit volcanic basalt soil.

### Palette Roles
- **Primary Forest Green (`#1F5D42`):** Primary action buttons, active tab states, major headings, verified destination markers, and high-priority controls.
- **Secondary Leaf Green (`#65A96E`):** Secondary accents, success indicators, category tags, interactive progress indicators, and gentle surface tints.
- **Local Earth / Ochre (`#C58A3A`):** Basalt earth tone representing highland culture and agriculture; serves as the primary accent for smart AI highlights, seasonal harvest badges, ratings, and active map pins.
- **Light Earth Yellow (`#E7C37A`):** Used at lower opacities or solid fills for AI suggestion chips, advisory banners, and cultural bookmark backdrops.
- **Background (`#F6F8F5`):** Light warm green-tinted canvas that reduces glare and eye fatigue outdoors.
- **Surface (`#FFFFFF`):** High-contrast cards, bottom sheets, navigation bars, and modals.
- **Text Primary (`#1C2520`):** Ultra-deep evergreen charcoal for maximum legibility of Vietnamese diacritics.
- **Text Secondary (`#6B756F`):** Muted botanical gray for metadata, timestamps, location details, and secondary captions.
- **Border / Divider (`#E3E9E5`):** Subtle organic stroke preventing the need for heavy contrast boundaries.

## Typography

The type hierarchy uses **Inter** for its neutral geometry, robust rendering within mobile webviews, and open counters that preserve Vietnamese diacritical marks (dấu hỏi, ngã, nặng, sắc, huyền) without collision or clipping.

### Editorial Guidelines
- Use generous line heights (minimum 1.4x for body copy) to ensure Vietnamese diacritics remain legible on mobile displays.
- Keep titles and cards to two lines maximum with clean truncation to maintain strict vertical rhythm.
- Numerals in currency and duration tags (e.g., "120.000 đ", "3 ngày 2 đêm") utilize tabular figures (`tnum`) for consistent vertical alignment across trip comparison cards.

## Layout & Spacing

This design system targets touch-screen mobile devices, using a standard 390px reference frame for the Zalo Mini App environment with safe-area considerations for top navigation headers and bottom tab navigation.

### Layout Principles
- **Grid Architecture:** 4-column fluid mobile grid with 16px (`1rem`) outer margins and 12px (`0.75rem`) gutters.
- **Rhythm & Touch Targets:** All interactive triggers maintain an absolute minimum touch zone of 44×44px, with default primary button heights set to 48px.
- **Horizontal Carousels:** Category chips, featured eco-tours, and scenic viewpoint cards utilize overflow bleeding off the right margin (`margin-right: -1rem` offset with internal scrolling padding) to invite discovery without overwhelming vertical flow.

## Elevation & Depth

To sustain a fresh, unpolluted atmosphere, depth relies primarily on border delineation, subtle background shifts, and soft atmospheric shadows rather than heavy drop shadows.

### Elevation Tiers
- **Flat Surface (Level 0):** Used for base page canvas (`#F6F8F5`).
- **Raised Card (Level 1):** Main content cards and list items set on `#FFFFFF` with a 1px solid `#E3E9E5` border and ambient shadow: `0 4px 16px rgba(28, 37, 32, 0.04)`.
- **Floating Overlays (Level 2):** Floating booking summaries, AI prompt bottom sheets, and sticky action footers: `0 8px 24px rgba(28, 37, 32, 0.08)` paired with an upper border of `#E3E9E5`.
- **Modals & Dialogs (Level 3):** Centered confirmation dialogs and full-sheet filters: `0 16px 36px rgba(28, 37, 32, 0.12)`.

## Shapes

The shape system balances modern tech clarity with organic curves, reflecting hills, foliage, and natural stones.

### Shape Scale
- **Pill (Fully Rounded / 9999px):** Category filter chips, status badges, AI prompt tags, and quick-call floating buttons.
- **Cards & Surfaces (`16px - 20px`):** Large destination previews, homestay profile cards, agricultural workshop containers, and interactive maps.
- **Buttons & Form Fields (`12px - 14px`):** Call-to-action buttons, search bars, quantity adjusters, and booking inputs.
- **Media Radii (`16px`):** Photographs of waterfalls, pine forests, and farm tours always carry an inner smooth radius matching their parent surface.

## Components

### Buttons
- **Primary:** Background `#1F5D42`, text `#FFFFFF`, border-radius 12px, height 48px, font weight 600. Active state scales to 0.98.
- **Secondary:** Background transparent, border 1.5px solid `#1F5D42`, text `#1F5D42`, border-radius 12px, height 48px.
- **AI Suggestion Action:** Background `#C58A3A`, text `#FFFFFF`, border-radius 12px, height 44px; equipped with a subtle sparkle/leaf iconography prefix.

### Chips & Badges
- **Filter Chips:** Pill-shaped (height 36px), border 1px solid `#E3E9E5`, background `#FFFFFF`, text `#6B756F`. When selected: background `#1F5D42`, text `#FFFFFF`, border-color `#1F5D42`.
- **AI Recommendation Chips:** Background `rgba(231, 195, 122, 0.25)`, border 1px solid `#C58A3A`, text `#1C2520`, pill-shaped with leading amber indicator icon.
- **Cultural & Origin Badges:** Background `#C58A3A`, text `#FFFFFF`, 4px padding horizontal, 10px font size, 6px radius.

### Input Fields & Search
- **Search Bar:** 48px height, background `#FFFFFF`, border 1px solid `#E3E9E5`, radius 14px, leading search icon in `#65A96E`, placeholder color `#6B756F`.
- **Active State:** Focus ring with 1.5px border of `#1F5D42` and subtle outline.

### Cards
- **Destination & Tour Card:** `#FFFFFF` background, 16px corner radius, 1px `#E3E9E5` border. Image container uses 16:10 aspect ratio with 14px internal margin. Includes category pill on the top left and bookmark icon button on top right.
- **Smart AI Trip Plan Card:** `#FFFFFF` background with an accented top strip of `#C58A3A` (3px thickness), featuring subtle ochre icon highlights and organized milestone bullet points.

### Lists & Selectors
- **List Items:** Dividers use `#E3E9E5` with left padding aligned to text baseline.
- **Selection Controls:** Checkboxes and radio controls use `#1F5D42` for selected fill with white checkmarks. Unselected borders use `#E3E9E5`.