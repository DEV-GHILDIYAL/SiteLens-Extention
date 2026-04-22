# Content Checker Guide - SiteLens Extension

The **Content Checker** is a specialized tool within SiteLens designed to detect placeholder text, filler content (like "Lorem Ipsum"), and missing content segments during a live audit. It helps developers and QA testers ensure that production sites don't accidentally ship with template text.

## 🔍 Features

1.  **Placeholder Detection**: Automatically scans for variations of "Lorem Ipsum" and generic filler strings.
2.  **Segment Verification**: Allows you to upload a source text file (e.g., a `.docx` or `.txt` copy from a copywriter) and verify which segments are actually present on the rendered page.
3.  **Missing Content Reporting**: Provides a severity-ranked list of content blocks that were expected but not found.

## 🛠️ How to Use

### 1. Basic Lorem Ipsum Check
- Open the SiteLens side panel.
- Go to the **Analyze** tab.
- If placeholder text exists on the page, SiteLens will automatically flag it under the "Content" category in the final report.

### 2. Segment Comparison (Advanced)
If you have a specific list of copy that *should* be on the page:
1.  Navigate to the **Analyze** tab and scroll to the **Content Checker** section.
2.  **Upload Source**: Click "Upload File" and select your `.docx` or `.txt` source document.
3.  **Run Audit**: Click the **Check Content** button.
4.  **Verification Flow**: 
    - SiteLens will reload the page to ensure a fresh state.
    - It will then scroll through the page and attempt to match each line from your source document.
    - **Results**: You will see a percentage match and a list of "Missing Segments" if any part of your copy is absent from the live site.

## 💡 Best Practices

- **Clean Source Text**: Ensure your source document doesn't contain massive amounts of formatting or metadata that isn't supposed to be on the page.
- **Dynamic Content**: The tool scans the DOM at its current state. If content is hidden behind a toggle or interaction (like an accordion), ensure it is visible before running the check, or the tool may flag it as missing.
- **Fuzzy Matching**: SiteLens uses a "normalized" matching algorithm, meaning minor whitespace differences or case-sensitivity won't usually cause false negatives.

## 🔴 Common Issues Detected
- `Lorem ipsum dolor sit amet...`
- `Click here for more information` (Generic labels)
- `[Insert Text Here]` (Developer notes)
- `Coming Soon` (Stub content)
