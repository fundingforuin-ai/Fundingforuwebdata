---
name: High-Fidelity Wealth
colors:
  surface: '#12121f'
  surface-dim: '#12121f'
  surface-bright: '#383846'
  surface-container-lowest: '#0d0d19'
  surface-container-low: '#1a1a27'
  surface-container: '#1f1e2b'
  surface-container-high: '#292936'
  surface-container-highest: '#343341'
  on-surface: '#e3e0f3'
  on-surface-variant: '#ccc3d8'
  inverse-surface: '#e3e0f3'
  inverse-on-surface: '#2f2f3d'
  outline: '#958da1'
  outline-variant: '#4a4455'
  surface-tint: '#d2bbff'
  primary: '#d2bbff'
  on-primary: '#3f008e'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#732ee4'
  secondary: '#ddb7ff'
  on-secondary: '#490080'
  secondary-container: '#6f00be'
  on-secondary-container: '#d6a9ff'
  tertiary: '#ddb8ff'
  on-tertiary: '#490081'
  tertiary-container: '#844abe'
  on-tertiary-container: '#f2e0ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#f0dbff'
  tertiary-fixed-dim: '#ddb8ff'
  on-tertiary-fixed: '#2c0051'
  on-tertiary-fixed-variant: '#62259b'
  background: '#12121f'
  on-background: '#e3e0f3'
  surface-variant: '#343341'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 32px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
  stack-xl: 80px
---

## Brand & Style
The design system embodies a "Quiet Luxury" aesthetic for the fintech space, focusing on ultra-high-net-worth individuals who value precision, exclusivity, and technological sophistication. The brand personality is authoritative yet ethereal, blending the reliability of traditional private banking with the forward-leaning velocity of modern venture capital.

The visual style is a hybrid of **Modern Minimalism** and **Refined Glassmorphism**. It utilizes a "Deep Space" canvas where light is used sparingly and intentionally to guide the eye. Expect expansive whitespace (or "dark-space"), razor-sharp typography, and translucent layers that suggest depth without physical weight. Visual interest is generated through subtle violet glows and precision-engineered gradients rather than heavy textures.

## Colors
The palette is rooted in a "Midnight" foundation, using `#050510` to create an infinite depth that makes the purple accents feel like luminous energy. 

- **Primary & Accent Purple:** These are used for critical actions, active states, and brand signatures. They should frequently be applied as soft glows or subtle linear gradients (e.g., from `#7C3AED` to `#A855F7`).
- **Surface Strategy:** Use `#0B0B18` for elevated containers. These surfaces should often utilize a low-opacity border (10-15% white) to define edges against the pure black background.
- **Functional Colors:** Success states should use a muted Emerald, and Warning states a sophisticated Amber, both desaturated to maintain the premium dark aesthetic.

## Typography
The system uses **Hanken Grotesk** for its geometric purity and modern balance, providing the "Stripe-like" clarity required for complex financial data. For technical strings and labels, **Geist** provides a developer-grade precision that reinforces the fintech narrative.

- **Headlines:** Use tight tracking (`-0.04em`) on large display type to create a high-fashion, editorial impact. 
- **Hierarchy:** Maintain significant contrast between display sizes and body text. 
- **Labels:** Small labels and overlines should always use uppercase with generous tracking (`0.1em`) to evoke luxury watchmaking aesthetics.

## Layout & Spacing
The layout philosophy is built on **Generous Breathing Room**. In luxury fintech, density is the enemy of perceived value. 

- **Grid:** A 12-column fluid grid on desktop with wide 32px gutters. 
- **Vertical Rhythm:** Use large vertical steps (`stack-lg` and `stack-xl`) between major sections to allow the eye to rest and focus on one data cluster at a time.
- **Adaptation:** On mobile, margins tighten to 20px, but vertical spacing remains significant to maintain the premium feel. Large headlines should wrap elegantly, never shrinking to the point of losing their "display" character.

## Elevation & Depth
Depth is created through light and transparency rather than heavy shadows.

- **Glassmorphism:** Use `backdrop-filter: blur(20px)` on all primary modal and navigation surfaces. Combine this with a `0.5px` white border at `10%` opacity to simulate the edge of a glass pane.
- **Luminous Glows:** Use "Orbital Glows"—large, low-opacity radial gradients of the Primary Purple—positioned behind key cards or in corners of the viewport to create atmospheric depth.
- **Tonal Stacking:** 
  1. **Level 0 (Base):** Background (`#050510`).
  2. **Level 1 (Card):** Surface (`#0B0B18`) with subtle border.
  3. **Level 2 (Active/Hover):** Surface with a linear gradient stroke and a faint inner glow.

## Shapes
The shape language is sophisticated and controlled. We avoid the "bubbly" feel of consumer social apps, opting for a structured **Rounded** profile (`0.5rem` or `8px` base).

- **Standard Elements:** Buttons and input fields use `8px` corner radius.
- **Containers:** Large dashboard cards and modals use `rounded-xl` (`1.5rem` or `24px`) to feel modern and "Apple-esque."
- **Charts:** Financial data visualizations should use rounded line caps and smoothed corner paths for a fluid, organic feel.

## Components
- **Buttons:** Primary buttons use a solid gradient from Primary Purple to Accent Purple. Text is white, medium weight. Use a subtle `0 4px 20px rgba(124, 58, 237, 0.3)` outer glow on hover.
- **Input Fields:** Ghost-style inputs with `#0B0B18` backgrounds and `1px` borders in `rgba(255,255,255,0.1)`. On focus, the border transitions to Primary Purple with a `2px` soft outer glow.
- **Cards:** Utilize the glassmorphism rules. No heavy shadows; instead, use a 1px "glass" border and the Surface color. Backgrounds of cards should have a very subtle grain texture (2% opacity) to add a tactile feel.
- **Chips/Status:** Small, pill-shaped, with low-opacity fills (10% of the status color) and high-contrast text.
- **Data Visuals:** Charts should use "Glow Lines"—the line graph itself should have a drop-shadow of the same color to make the data appear as if it is neon/luminous.
- **Navigation:** A top-fixed frosted glass bar with a blurred background. Navigation items use `label-caps` typography for an elite feel.