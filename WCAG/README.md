    # SiteLens - The Professional Accessibility & Design Toolkit

    **SiteLens** is a powerful Chrome Extension that transforms how developers and auditors approach WCAG compliance, SEO, and design audits. It analyzes what the user actually sees, providing real-world insights that DOM-only tools often miss.

    ---

    ## ✨ Features Breakdown

    ### 🛠️ Accessibility Audit Module
    | Feature | Description |
    | :--- | :--- |
    | **Contrast Analyzer** | Analyzes rendered appearance (not just CSS) to detect WCAG 2.1 AA/AAA contrast violations across text, images, and gradients. |
    | **Manual Checker** | A designer's sandbox for testing color combinations. Input hex codes to see live contrast ratios and accessibility results. |
    | **Image Audit** | Scans for missing `alt` attributes, empty labels, and accessibility issues in image tags to ensure screen-reader compatibility. |
    | **Button Audit** | Checks button casing (e.g., All Caps vs Sentence Case) and verifies color contrast specifically for interactive elements. |
    | **Image Integrity** | A site-wide tool that scans multiple URLs to identify duplicate images and repeated assets across different pages. |

    ### 🔍 Navigation & Structure Module
    | Feature | Description |
    | :--- | :--- |
    | **Hyperlink Detector** | Crawls the page (including lazy-loaded content) to list all links, check for broken paths, and verify destination titles. |
    | **Button Analyze** | Specifically targets buttons to verify their redirect destinations and ensure they lead to the correct internal or external pages. |
    | **SEO Audit** | Extracts and analyzes Meta Titles, Descriptions, and Open Graph tags to ensure the page is search-engine ready. |
    | **Font Audit** | Visualizes the heading hierarchy (H1-H6) and checks font properties like weight and size for structural consistency. |

    ### 🎨 Design & Assets Module
    | Feature | Description |
    | :--- | :--- |
    | **Color Extractor** | Automatically builds a color palette by extracting every unique color used in the site's CSS and assets. |
    | **Theme Generator** | Takes brand colors and generates WCAG-compliant variations for backgrounds, text, and accents. |
    | **Image Downloader** | Finds all images on a page (including CSS backgrounds) and allows for individual or bulk downloading. |
    | **Screenshot Tool** | High-quality captures of the visible screen, the entire scrollable page, or a custom-selected area. |

    ### 📝 Content Tools Module
    | Feature | Description |
    | :--- | :--- |
    | **Content Check** | Compare on-page text against uploaded documents (.txt, .docx) to verify that marketing copy or legal text is present. |
    | **Content Splitter** | Deconstructs long-form content into manageable segments based on headings, making it easier to audit specific sections. |
    | **Lorem Detector** | Scans for placeholder text like "Lorem Ipsum" to prevent accidental production deployments of unfinished copy. |
    | **AI Self-Audit** | A sophisticated simulation of human auditing that checks dynamic elements and complex UI interactions for accessibility gaps. |
    | **Alt Text Gen** | Generates SEO-optimized, descriptive alt text for images based on company, page, and image context. |

    ---

    ## 🔧 Technical Overview

    ### Analysis Engine
    SiteLens uses a multi-layered analysis pipeline:
    1.  **DOM Traversal**: Intelligent filtering of visible content vs. hidden UI.
    2.  **Visual Sampling**: Canvas-based pixel analysis for handling gradients and background images.
    3.  **Luminance Calculation**: Precise WCAG formulas for calculating contrast ratios.
    4.  **Reporting**: Exportable JSON/HTML reports for documentation and handoffs.

    ### Key Components
    - `contrast-analyzer.js`: Core engine for color and contrast logic.
    - `text-detector.js`: Filters content text from decorative or UI elements.
    - `background-sampler.js`: Composite sampling for complex backgrounds.
    - `font-analyzer.js`: Logic for heading hierarchy and typography audits.
    - `seo-analyzer.js`: Meta tag and structure validation.

    ---

    ## 📦 Installation

    1.  Clone this repository: `git clone https://github.com/DEV-GHILDIYAL/SiteLens-Extention.git`
    2.  Navigate to `chrome://extensions/` in Google Chrome.
    3.  Enable **Developer mode** (top right toggle).
    4.  Click **Load unpacked** and select the `/WCAG` folder from the project directory.

    ---

    ## 🚀 Usage

    1.  Open the Chrome **Side Panel** (usually via the extension icon).
    2.  Navigate to the page you wish to audit.
    3.  Select a feature category (e.g., **Accessibility Audit**).
    4.  Click on a feature card (e.g., **Contrast Analyzer**).
    5.  Press the **Analyze** button to start the audit.
    6.  Use the **Back to Features** button to switch between tools.

    ---

    ## 📊 WCAG Standards Compliance
    - **AA Requirements**: 4.5:1 for normal text, 3:1 for large text.
    - **AAA Requirements**: 7:1 for normal text, 4.5:1 for large text.

    ---

    ## 👨‍💻 Developer Spotlight
    **Dev Lalit Ghildiyal**
    *   **Background**: B.Sc. Computer Science (CGPA: 9.02)
    *   **Specialization**: MERN Stack, Data Analytics, Python Automation.
    *   **Goal**: Building tools that bridge the gap between design and accessibility.

    ---

    **Made with ❤️ by DEV GHILDIYAL**