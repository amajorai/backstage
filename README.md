<table width="100%">
  <tr>
    <td align="center" width="120">
      <img src="apps/desktop/app-icon.png" alt="Logo" width="100" style="border-radius: 20%;"/>
    </td>
    <td align="right">
      <h1>Backstage</h1>
      <h3 style="margin-top: -10px;">Everything you need to make great YouTube thumbnails</h3>
    </td>
  </tr>
</table>

A desktop app for extracting video frames, editing with layers, removing backgrounds with AI, and generating images with Gemini. Built with Tauri and React.

[![Windows](https://img.shields.io/badge/Windows-Download-blue?logo=windows)](https://github.com/jiaweing/Backstage/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-Download-white?logo=apple)](https://github.com/jiaweing/Backstage/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-Download-orange?logo=linux)](https://github.com/jiaweing/Backstage/releases/latest)

---

## Features

### Gallery

- Thumbnail grid view (3x3, 4x4, 5x5) and list view
- Search and filter thumbnails
- Sort by name, date added, or last edited
- Drag selection for bulk operations
- Batch duplicate, delete, and background removal
- 30-day trash with restore and permanent deletion

### Video Frame Extraction

- Scrub through video timeline with frame-accurate preview
- Extract any frame as a full-resolution image
- Supports MP4, WebM, and other common formats

### Image Editor

- Layer-based editing: drag, resize, rotate, and reorder layers
- Pan mode for navigating large canvases
- Clipboard support: cut, copy, paste layers across projects
- Add images from the gallery as overlay layers
- Empty layer creation for drawing and painting
- Brush tool with adjustable size and opacity via keyboard shortcuts
- Logo picker with display variants and recent logo history
- Adjustable canvas size
- Undo/redo
- Auto-save with unsaved changes detection

### Background Removal

Two engines are available depending on which build you are running:

**ISNet via img.ly** (available in all builds)

Runs entirely in the browser using WebAssembly. No extra downloads required on first run beyond the model weights, which are cached locally.

Three quality presets:

| Preset | Model size | Notes |
|--------|-----------|-------|
| Fast | ~40 MB | Good for quick previews |
| Balanced | ~80 MB | Recommended default |
| Best | ~160 MB | Highest accuracy, slower |

**BRIA RMBG-1.4** (open-source build only)

Runs natively via ONNX Runtime, compiled into the app as a Rust binary. The model (~176 MB) is downloaded once from Hugging Face on first use and stored in the app data directory. No internet connection required after that.

This engine uses the [BRIA RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) model, which is licensed for non-commercial use only. It is excluded from the commercial release for this reason.

### AI Image Generation

- Gemini-powered image generation (bring your own API key)
- Generate multiple variations in one request
- Save generated images as new layers or directly to the gallery

### Export

- PNG, JPEG, and WebP formats
- Custom resolution and quality settings
- Preview before export

---

## Builds and Distribution

This project has two build configurations.

### Commercial release

The version distributed through the website and sold via Polar. This build uses only the img.ly background removal engine.

```bash
bun run desktop:build
```

Or directly:

```bash
cd apps/desktop
bunx tauri build
```

### Open-source build

The version published on GitHub. This build includes the BRIA RMBG-1.4 background removal engine in addition to img.ly. The BRIA option is gated behind a Cargo feature flag (`bria`) and is compiled out entirely in the commercial build — no dead code, no extra binary size.

**Windows:**

```bash
cd apps/desktop
bunx tauri build --config tauri.bria.windows.conf.json -- --features bria
```

The `tauri.bria.windows.conf.json` config adds `DirectML.dll` to the bundle. This is a Microsoft DirectX ML library that ONNX Runtime depends on for GPU acceleration on Windows. It is generated automatically during the build and needs to be included alongside the executable.

**macOS and Linux:**

```bash
cd apps/desktop
bunx tauri build -- --features bria
```

On macOS and Linux, ONNX Runtime is linked statically into the binary. No additional libraries need to be bundled.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) — JavaScript runtime and package manager
- [Rust](https://rustup.rs/) — required for Tauri

### Install dependencies

```bash
bun install
```

### Run in development

Standard development (commercial feature set):

```bash
bun run desktop:dev
```

Development with the BRIA background removal engine enabled:

```bash
cd apps/desktop
bun run dev
```

The desktop `dev` script already includes `--features bria` so the BRIA option appears in Settings during development.

### Build

```bash
bun run desktop:build
```

Installers are output to `apps/desktop/src-tauri/target/release/bundle/`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri v2](https://v2.tauri.app) |
| Frontend | [React 19](https://react.dev) + [Vite](https://vitejs.dev) |
| Styling | [TailwindCSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| Database | [SQLite](https://www.sqlite.org) via Tauri SQL plugin |
| Background removal (browser) | [@imgly/background-removal](https://github.com/imgly/background-removal-js) |
| Background removal (native) | [ONNX Runtime](https://onnxruntime.ai) via [ort](https://github.com/pykeio/ort) |
| AI generation | [Google Gemini API](https://ai.google.dev) |
| Secure storage | AES-256-GCM encrypted key/value store |

---

## Project Structure

```
apps/desktop/
├── src/
│   ├── components/
│   │   ├── editor/              # Editor sub-components (canvas, toolbar, layers)
│   │   ├── gallery/             # Gallery grid, list, and selection components
│   │   ├── gemini/              # AI image generation UI
│   │   ├── trash/               # Trash page components
│   │   ├── Gallery.tsx          # Main gallery view
│   │   ├── ImageEditor.tsx      # Layer-based editor
│   │   ├── GeminiImagePage.tsx  # Gemini generation page
│   │   ├── SettingsPage.tsx     # App settings
│   │   └── TrashPage.tsx        # Trash management
│   ├── stores/                  # Zustand state stores
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities and helpers
│   └── workers/                 # Web Workers (background removal)
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs               # Tauri setup and command registration
│   │   ├── background_removal.rs # BRIA RMBG-1.4 inference (bria feature only)
│   │   └── secure_storage.rs    # Encrypted key/value storage
│   ├── tauri.conf.json          # Base app configuration
│   └── tauri.bria.windows.conf.json # Resource overrides for Windows OSS build
└── package.json
```

---

## Data Storage

All app data is stored in the OS-specific app data directory. This includes the SQLite database, encrypted settings, thumbnail files, and downloaded AI model weights.

| OS | Path |
|----|------|
| Windows | `C:\Users\<user>\AppData\Roaming\pub.youtube.desktop` |
| macOS | `~/Library/Application Support/pub.youtube.desktop` |
| Linux | `~/.local/share/pub.youtube.desktop` |

The BRIA model, when downloaded, is stored at `<app data>/models/rmbg/model.onnx`.

---

## License

The source code is open source. The BRIA RMBG-1.4 model is subject to its own license and is restricted to non-commercial use. See [the model page](https://huggingface.co/briaai/RMBG-1.4) for details.
