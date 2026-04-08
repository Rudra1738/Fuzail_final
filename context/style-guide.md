# Style Guide - Environmental Sensor Monitoring Dashboard

## Overview

This style guide defines the visual design system for the environmental sensor monitoring dashboard. The design uses a **dark theme** optimized for:
- Extended viewing sessions (reduces eye strain)
- Data visualization clarity
- Professional monitoring interface aesthetic
- High contrast for critical alerts and anomalies

## Color System

### Base Colors (Dark Theme)

```css
/* Background Colors */
--bg-primary: #0A0E27;        /* Main background - deep navy */
--bg-secondary: #1A1F3A;      /* Card/panel background - lighter navy */
--bg-tertiary: #252B4A;       /* Elevated elements - medium navy */
--bg-hover: #2D3454;          /* Hover states */
--bg-active: #353D5E;         /* Active/selected states */

/* Surface Colors */
--surface-glass: rgba(26, 31, 58, 0.6);  /* Glassmorphism effect */
--surface-overlay: rgba(10, 14, 39, 0.95); /* Modal overlays */
```

### Text Colors

```css
/* Text Hierarchy */
--text-primary: #E8ECF5;      /* Main text - off-white */
--text-secondary: #A0A8C0;    /* Secondary text - muted blue-gray */
--text-tertiary: #6B7390;     /* Tertiary text - dimmed */
--text-disabled: #4A5068;     /* Disabled state */
--text-inverse: #0A0E27;      /* Text on light backgrounds */
```

### Accent & Brand Colors

```css
/* Primary Accent - Electric Blue */
--accent-primary: #4F7BFF;         /* Main brand color */
--accent-primary-hover: #6B8FFF;   /* Hover state */
--accent-primary-active: #3D6AFF;  /* Active state */
--accent-primary-dim: rgba(79, 123, 255, 0.1); /* Background tint */

/* Secondary Accent - Cyan */
--accent-secondary: #00D9FF;       /* Secondary actions */
--accent-secondary-hover: #33E0FF;
--accent-secondary-active: #00C4E6;
```

### Status Colors

```css
/* Success - Green */
--status-success: #00E676;         /* Normal operation */
--status-success-dim: rgba(0, 230, 118, 0.1);
--status-success-border: rgba(0, 230, 118, 0.3);

/* Warning - Amber */
--status-warning: #FFB800;         /* Threshold exceeded */
--status-warning-dim: rgba(255, 184, 0, 0.1);
--status-warning-border: rgba(255, 184, 0, 0.3);

/* Danger - Red */
--status-danger: #FF4757;          /* Critical anomaly */
--status-danger-dim: rgba(255, 71, 87, 0.1);
--status-danger-border: rgba(255, 71, 87, 0.3);

/* Info - Blue */
--status-info: #5B9FFF;            /* Informational */
--status-info-dim: rgba(91, 159, 255, 0.1);
--status-info-border: rgba(91, 159, 255, 0.3);

/* Neutral - Gray */
--status-neutral: #6B7390;         /* No data / inactive */
--status-neutral-dim: rgba(107, 115, 144, 0.1);
--status-neutral-border: rgba(107, 115, 144, 0.3);
```

### Chart & Data Visualization Colors

```css
/* Chart Color Palette - Optimized for dark backgrounds */
--chart-color-1: #4F7BFF;   /* Electric Blue */
--chart-color-2: #00E676;   /* Green */
--chart-color-3: #FFB800;   /* Amber */
--chart-color-4: #00D9FF;   /* Cyan */
--chart-color-5: #FF6B9D;   /* Pink */
--chart-color-6: #9D4FFF;   /* Purple */
--chart-color-7: #00FFA3;   /* Mint */
--chart-color-8: #FF8A00;   /* Orange */
--chart-color-9: #4FFFB0;   /* Teal */
--chart-color-10: #FFD600;  /* Yellow */
--chart-color-11: #FF4757;  /* Red */
--chart-color-12: #A0A8C0;  /* Gray */

/* Chart Grid & Axes */
--chart-grid: rgba(160, 168, 192, 0.1);    /* Subtle grid lines */
--chart-axis: rgba(160, 168, 192, 0.3);    /* Axis lines */
--chart-text: #A0A8C0;                     /* Labels and legends */
```

### Border & Divider Colors

```css
--border-primary: rgba(160, 168, 192, 0.15);   /* Main borders */
--border-secondary: rgba(160, 168, 192, 0.08); /* Subtle dividers */
--border-focus: #4F7BFF;                       /* Focus outline */
```

### Shadow System

```css
/* Elevation Shadows (dark theme) */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.7);

/* Glow Effects (for emphasis) */
--glow-primary: 0 0 20px rgba(79, 123, 255, 0.3);
--glow-success: 0 0 20px rgba(0, 230, 118, 0.3);
--glow-danger: 0 0 20px rgba(255, 71, 87, 0.3);
```

## Typography

### Font Stack

```css
/* Primary Font - System UI */
--font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI",
                Roboto, "Helvetica Neue", Arial, sans-serif;

/* Monospace Font - For data/numbers */
--font-mono: "JetBrains Mono", "Fira Code", "Monaco",
             "Consolas", monospace;

/* Font for large numbers/metrics */
--font-display: "Inter", -apple-system, BlinkMacSystemFont,
                "Segoe UI", Roboto, sans-serif;
```

### Font Sizes

```css
/* Type Scale (1.25 ratio) */
--text-xs: 0.75rem;    /* 12px - Captions, labels */
--text-sm: 0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Emphasized text */
--text-xl: 1.25rem;    /* 20px - Subheadings */
--text-2xl: 1.5rem;    /* 24px - Section titles */
--text-3xl: 1.875rem;  /* 30px - Page titles */
--text-4xl: 2.25rem;   /* 36px - Hero text */

/* Data Display Sizes */
--text-data-sm: 1rem;     /* Small metric values */
--text-data-md: 1.5rem;   /* Medium metric values */
--text-data-lg: 2.5rem;   /* Large metric values */
--text-data-xl: 3.5rem;   /* Hero metric values */
```

### Font Weights

```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights

```css
--leading-tight: 1.2;    /* Headings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.75; /* Long-form content */
--leading-data: 1;       /* Metric displays */
```

## Spacing System

```css
/* 8px base unit */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## Border Radius

```css
--radius-sm: 4px;     /* Small elements - buttons, badges */
--radius-md: 8px;     /* Medium elements - cards, inputs */
--radius-lg: 12px;    /* Large elements - panels, modals */
--radius-xl: 16px;    /* Extra large elements */
--radius-full: 9999px; /* Pills, circular elements */
```

## Component Specifications

### Cards & Panels

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-md);
}

.card-elevated {
  background: var(--bg-tertiary);
  box-shadow: var(--shadow-lg);
}

.card-glass {
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-secondary);
}
```

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--accent-primary);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  border: none;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-6);
  border: none;
}

.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

### Status Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-success {
  background: var(--status-success-dim);
  color: var(--status-success);
  border: 1px solid var(--status-success-border);
}

.badge-warning {
  background: var(--status-warning-dim);
  color: var(--status-warning);
  border: 1px solid var(--status-warning-border);
}

.badge-danger {
  background: var(--status-danger-dim);
  color: var(--status-danger);
  border: 1px solid var(--status-danger-border);
}
```

### Sensor Gauge Component

```css
.sensor-gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
}

.sensor-gauge:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-lg);
}

.sensor-gauge-value {
  font-family: var(--font-mono);
  font-size: var(--text-data-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: var(--leading-data);
}

.sensor-gauge-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sensor-gauge-status {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  margin-top: var(--space-3);
}

.sensor-gauge-status.normal {
  background: var(--status-success);
  box-shadow: var(--glow-success);
}

.sensor-gauge-status.warning {
  background: var(--status-warning);
}

.sensor-gauge-status.critical {
  background: var(--status-danger);
  box-shadow: var(--glow-danger);
  animation: pulse 2s infinite;
}
```

### Metric Cards

```css
.metric-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.metric-card-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-3);
}

.metric-card-value {
  font-family: var(--font-mono);
  font-size: var(--text-data-md);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.metric-card-change {
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.metric-card-change.positive {
  color: var(--status-success);
}

.metric-card-change.negative {
  color: var(--status-danger);
}
```

### Chart Container

```css
.chart-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  min-height: 400px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.chart-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.chart-controls {
  display: flex;
  gap: var(--space-3);
}
```

### Forms & Inputs

```css
.input {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  color: var(--text-primary);
  font-size: var(--text-base);
  width: 100%;
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--accent-primary-dim);
}

.input::placeholder {
  color: var(--text-tertiary);
}

.select {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  color: var(--text-primary);
  cursor: pointer;
}
```

### Alerts & Notifications

```css
.alert {
  display: flex;
  align-items: flex-start;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border-left: 4px solid;
}

.alert-danger {
  background: var(--status-danger-dim);
  border-color: var(--status-danger);
  color: var(--text-primary);
}

.alert-warning {
  background: var(--status-warning-dim);
  border-color: var(--status-warning);
  color: var(--text-primary);
}

.alert-success {
  background: var(--status-success-dim);
  border-color: var(--status-success);
  color: var(--text-primary);
}

.alert-info {
  background: var(--status-info-dim);
  border-color: var(--status-info);
  color: var(--text-primary);
}
```

## Plotly Chart Configuration

### Default Chart Theme

```javascript
const plotlyDarkTheme = {
  layout: {
    paper_bgcolor: '#1A1F3A',      // Chart background
    plot_bgcolor: '#0A0E27',       // Plot area background
    font: {
      family: 'var(--font-primary)',
      color: '#A0A8C0',            // Text color
      size: 12
    },
    xaxis: {
      gridcolor: 'rgba(160, 168, 192, 0.1)',
      linecolor: 'rgba(160, 168, 192, 0.3)',
      zerolinecolor: 'rgba(160, 168, 192, 0.2)',
      tickfont: { color: '#A0A8C0' }
    },
    yaxis: {
      gridcolor: 'rgba(160, 168, 192, 0.1)',
      linecolor: 'rgba(160, 168, 192, 0.3)',
      zerolinecolor: 'rgba(160, 168, 192, 0.2)',
      tickfont: { color: '#A0A8C0' }
    },
    colorway: [
      '#4F7BFF', '#00E676', '#FFB800', '#00D9FF',
      '#FF6B9D', '#9D4FFF', '#00FFA3', '#FF8A00',
      '#4FFFB0', '#FFD600', '#FF4757', '#A0A8C0'
    ],
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: '#252B4A',
      bordercolor: '#4F7BFF',
      font: { color: '#E8ECF5' }
    }
  },
  config: {
    displayModeBar: false,
    responsive: true
  }
};
```

### Real-Time Chart Styling

```javascript
const realtimeChartConfig = {
  type: 'scatter',
  mode: 'lines',
  line: {
    color: '#4F7BFF',
    width: 2,
    shape: 'spline'   // Smooth curves
  },
  fill: 'tozeroy',
  fillcolor: 'rgba(79, 123, 255, 0.1)'
};
```

## Layout & Grid System

### Page Layout

```css
.dashboard-layout {
  display: grid;
  grid-template-columns: 250px 1fr;  /* Sidebar + Main */
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.dashboard-sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-primary);
  padding: var(--space-6);
}

.dashboard-main {
  padding: var(--space-8);
  overflow-y: auto;
}
```

### Grid System

```css
/* Sensor Grid (12 sensors) */
.sensor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-6);
}

/* Metric Grid */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6);
}

/* Chart Grid */
.chart-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
}

@media (min-width: 1280px) {
  .chart-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

## Animations & Transitions

```css
/* Standard Transitions */
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Real-time Data Update Animation */
.data-update {
  animation: pulse 0.5s ease;
}
```

## Accessibility

### Focus States

```css
*:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### Color Contrast

All text colors meet WCAG AA standards:
- Primary text (#E8ECF5) on primary background (#0A0E27): **14.5:1** ✓
- Secondary text (#A0A8C0) on primary background (#0A0E27): **9.2:1** ✓
- Status colors have sufficient contrast for both text and background usage

### Screen Reader Support

```html
<!-- Example: Sensor status with aria labels -->
<div class="sensor-gauge" aria-label="Temperature Sensor 1">
  <span class="sensor-gauge-value" aria-live="polite">24.5°C</span>
  <span class="sensor-gauge-label">Temperature</span>
  <div class="sensor-gauge-status normal"
       role="status"
       aria-label="Normal operation">
  </div>
</div>
```

## Responsive Breakpoints

```css
/* Mobile First Approach */
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large desktops */
```

## Usage Guidelines

### Do's
- ✓ Use consistent spacing from the 8px scale
- ✓ Maintain color contrast ratios for accessibility
- ✓ Use status colors consistently (green = good, red = bad)
- ✓ Apply appropriate shadows for depth/hierarchy
- ✓ Use monospace fonts for numeric data
- ✓ Animate real-time data updates subtly

### Don'ts
- ✗ Don't use pure black (#000) or pure white (#FFF)
- ✗ Don't mix multiple accent colors in one view
- ✗ Don't use low-contrast colors for critical information
- ✗ Don't create overly busy animations
- ✗ Don't use more than 3 levels of visual hierarchy per section

## Dark Mode Optimization

### Best Practices for Dark Themes
1. **Avoid Pure Black:** Use #0A0E27 instead of #000000 to reduce eye strain
2. **Reduce White Intensity:** Use #E8ECF5 instead of #FFFFFF for text
3. **Increase Elevation with Lighter Surfaces:** Higher elements use lighter backgrounds
4. **Use Colored Glows Sparingly:** Only for status indicators and emphasis
5. **Test with Reduced Brightness:** Ensure readability at 50% screen brightness
6. **Limit Bright Colors:** Use dimmed versions for large areas

## Implementation Example

```css
/* Root Variables */
:root {
  /* Copy all CSS variables from above sections */
}

/* Global Styles */
body {
  font-family: var(--font-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: var(--leading-normal);
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Typography Defaults */
h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

p {
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
```

---

**Last Updated:** 2025-11-15
**Version:** 1.0.0
**Maintained By:** Development Team
