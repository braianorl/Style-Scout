# Style Scout

**Style Scout** is a Figma plugin designed to track and audit all styles used in your document. It helps designers maintain clean design systems by identifying external library styles, loose colors, and providing detailed usage statistics.

## Features

- 🔍 **Smart Document Scanning**: Scans your entire document to identify all styles in use
- 📚 **Library Style Tracking**: Lists all external library styles used in your document
- 🎨 **Loose Color Detection**: Identifies colors that are detached from your design system
- 📊 **Usage Statistics**: Shows how many times each style is used
- 🧭 **Quick Navigation**: Click on any style to locate and select elements using it
- ⚡ **Performance Optimized**: Efficient scanning with immediate user feedback

## How to Use

1. **Install the Plugin**: Add Style Scout to your Figma plugins
2. **Open Your Document**: Navigate to the document you want to audit
3. **Launch Style Scout**: Run the plugin from the Plugins menu
4. **Scan Document**: Click the "Scan Document" button to analyze your file
5. **Review Results**: Browse through the detected libraries and loose colors
6. **Navigate to Elements**: Click on any style to find and select elements using it

## Plugin Structure

- `manifest.json` - Plugin configuration and metadata
- `code.ts` - Main plugin logic (TypeScript source)
- `code.js` - Compiled JavaScript output
- `ui.html` - Plugin user interface
- `package.json` - Dependencies and build configuration
- `tsconfig.json` - TypeScript compiler configuration

## Development

This plugin is built with TypeScript and uses the Figma Plugin API. To build:

```bash
npm install
npm run build
```

## About

Style Scout helps maintain design system consistency by providing clear visibility into style usage across your Figma documents. Whether you're auditing legacy files or ensuring new designs follow your design system, Style Scout makes it easy to identify and manage your styles.

---

*Built with ❤️ for the Figma design community*
