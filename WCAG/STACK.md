# Technology Stack - SiteLens Extension

This document outlines the core technologies, libraries, and tools used in the SiteLens extension.

## 🛠️ Core Technologies

- **Browser Extension Platform**: Manifest V3 (Chrome, Edge, Brave, etc.)
- **Language**: JavaScript (ES6+)
- **Storage**: `chrome.storage.local` for settings, last reports, and persistent data.
- **Communication**: Chrome Messaging API (`runtime.sendMessage`, `tabs.sendMessage`) for interaction between Side Panel, Background, and Content Scripts.

## 🎨 UI & Design

- **Side Panel**: HTML5, Vanilla CSS, Vanilla JavaScript.
- **Theming**: Dark mode focused design with glassmorphism elements.
- **Lucide Icons**: Used for consistent, high-quality UI iconography.
- **Fonts**: System defaults with custom styling for clarity.

## 🔍 Analysis Engine

- **DOM Processing**: Custom traverser (`dom-traverser.js`) with intelligent filtering for visibility and relevance.
- **Visual Analysis**:
    - **Canvas API**: Used for pixel-level sampling of backgrounds (images, gradients).
    - **OffscreenCanvas**: Utilized in the background worker for image cropping and processing without UI block.
- **Accessibility Logic**:
    - **WCAG 2.1 Formula**: Relative luminance and contrast ratio calculations (`wcag-calculator.js`).
    - **Sampling Algorithms**: Multi-point sampling for complex backgrounds (gradients/images).

## 📦 Third-Party Libraries (Locally Bundled)

- **PDF.js**: For PDF-related analysis (if implemented).
- **Mammoth.js**: For .docx text extraction (if implemented).
- **html2canvas** (referenced/planned): For capturing visual snapshots of elements.

## 🧪 Testing & Quality

- **Unit Testing**: Chrome Extension testing framework (implied by `tests/` directory).
- **Manual Testing**: Real-world site audits (GitHub, Wikipedia, etc.).

## 🚀 Dev Ops & Workflow

- **CI/CD**: GitHub Actions (planned or partially implemented).
- **Roadmap Management**: GSD (Goals, Strategy, Decomposition) framework via `ROADMAP.md`.
