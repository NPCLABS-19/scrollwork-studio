# Scrollwork Studio

An interactive catalogue of ornamental vector patterns, with in-browser tracing and SVG/PNG export.

**Live site:** https://npclabs-19.github.io/scrollwork-studio/

**Source:** https://github.com/NPCLABS-19/scrollwork-studio

## Run

Requires Node.js 22.12+ (or a compatible newer version).

```sh
cd scrollwork-studio
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4317. Set `SCROLLWORK_PORT` to use another port. The server binds only to localhost. `npm run dev` serves a live development build through the same local Express server.

`Start Scrollwork Studio.command` starts or reopens the production app on macOS. It installs a per-user runtime at `~/Library/Application Support/Scrollwork Studio` and starts it through launchd so it survives closing the launching terminal or this chat. Logs are in `~/Library/Logs/Scrollwork Studio`. `Stop Scrollwork Studio.command` removes that running job. The launcher does not install a login-startup file.

After editing the source, run `npm run build`, then use Stop followed by Start to deploy the updated build to the local runtime.

## Use

- **New sheet** generates a catalogue of distinct motifs. Choose a construction family in the left column to constrain the next sheet.
- Select a motif and edit its proportions, curl, and line weight in the inspector. Construction guides expose drag handles for breadth and height.
- Save motifs to keep a collection. Lock a tile to preserve its place on the next generated sheet.
- **Endless exploration** makes a new seeded sheet every 4.5 seconds. Selecting a motif or changing its geometry pauses the stream.
- **Reference archive** opens ten faithful silhouette traces from the two supplied images.
- **Import a motif** accepts PNG, JPEG, or WebP. Drag a crop around one motif, or set its left/top/width/height with the keyboard-accessible percentage fields. Tune tracing, then add the vector to the catalogue. It also accepts simple path-only SVG and exported project JSON. SVG masks, reusable references, text, shapes, and stylesheet rules must be flattened to paths first.
- Imported outlines retain their shape. **Explore this family** starts a related procedural sheet, rather than recovering or editing the original construction rods.
- **Repeat study** tiles the selected motif. Use spacing and alternate rotation to change the arrangement. Tiles do not automatically connect across edges.
- Export a selected motif as transparent SVG, a whole sheet as SVG, or a 3600-pixel-wide PNG. Export a project JSON to keep the catalogue and saved motifs together.
- Browser local storage restores the last catalogue and saved collection. Project export is the portable backup.
- Keyboard shortcuts outside form fields: **G** new sheet, **F** save/unsave selected motif, **left/right arrows** select adjacent motifs. Enter in the seed field reproduces that seed.

On phones the working preview uses two columns for legibility; exports use the chosen column count.

## What “accurate” means

Image imports are prepared and traced entirely in the browser with WebAssembly Potrace. No uploaded image is sent to a server. The imported silhouette is preserved as traced vector paths. A source-mask overlap value compares the rasterised vector with its thresholded crop at the crop's original resolution. It is not a guarantee of the unknown pre-scan geometry.

The generator uses six explicit Bézier construction grammars and exact geometric transformations. It is reproducible and editable, but does not learn arbitrary ornament structure from an upload. See [RESEARCH.md](RESEARCH.md) for the rationale, sources, and the advanced reconstruction pipeline that would be needed for that capability.

## Validate

```sh
npm test
npm run build
npx playwright install chromium
# With npm start running:
npm run test:e2e
```

`npm run prepare:references` regenerates the archive from the bundled images. To substitute originals, pass their paths after `--`: `npm run prepare:references -- catalogue.jpg spindle.jpg`. The prepared archive is already included.

## Dependencies

Potrace's JavaScript port is GPL-2.0; its license is included in `node_modules/potrace/LICENSE`. Other dependency notices remain in their packages. Fonts are self-hosted from the Fontsource packages. The HTTP helper nested under Potrace is pinned to a patched version; uploaded images are decoded from local buffers rather than remote URLs.

## Ornament craft update

The current generator uses heavier primary strokes and restrained optical variation, with open volutes and deliberate joins. Primary lines remain at least 2.8 px wide in the tested 120×145 px preview frame. Older generated work is automatically rebuilt with craft version 2; the original browser project is backed up once under `scrollwork-studio-v1-before-craft-v2`. Imported silhouettes remain unchanged. The line-weight inspector now spans 6–14 SVG units. The original construction choices remain procedural interpretations of the references.

## GitHub Pages deployment

The public site is a static build; image tracing runs in the browser, so the hosted app has no backend dependency. Built-in references and fonts are bundled and use the repository base path.

```sh
npm ci
npm test
npm run deploy
```

The deploy command builds with `/scrollwork-studio/` as the base path and publishes the result to the `gh-pages` branch with a fast-forward push. GitHub Pages serves that branch's root directory. Deployment needs Git access to the repository and a configured Git author. Local runtime scripts remain optional; the live site does not require Node.js.

Browser data is specific to the current origin. Use Save project on the local app and import that JSON into the hosted app to transfer a collection.

## License

Source code: GPL-2.0-only, matching the included Potrace dependencies. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Reference imagery is separate source material and is not relicensed by the code license.
