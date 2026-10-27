# Building an accurate ornamental-pattern generator

## What the references are doing

The first image is a specimen catalogue of ornamental ironwork components. Its nine compositions reuse a small vocabulary: C- and S-scrolls, mirrored pairs, concave diamonds, four-lobed surrounds, collars, leaf terminals, and central rosettes. The second image has two opposing heart silhouettes, four small curls around a narrow waist, and six-point floral terminals. Its dominant organisation is bilateral reflection, with approximate reflection across the horizontal midpoint.

The strongest design properties are:

- **Order at large scale, variation at small scale.** Reflection and quarter turns make the whole silhouette legible; different curl sizes keep it moving.
- **A hierarchy of bend radii.** Broad arcs carry the composition, smaller curls terminate it. Tight curls everywhere produce visual congestion.
- **Designed negative space.** The central diamond, the heart-shaped openings, and the spaces inside the lobes have their own silhouettes.
- **Flowing continuation.** Smoothly approaching curves suggest a continuous rod, even when the ornament is actually assembled from multiple pieces.
- **Compression and release.** Narrow collars and waists contrast with broad outer lobes.
- **Material logic.** Sparse joins and relatively consistent rod thickness make the forms plausible as bent metal.

These are readings of the supplied images, not a universal formula for beauty. Research finds context-dependent preferences for symmetry and curved contours; it does not establish that one ratio guarantees a pleasing ornament. Neither reference requires a golden-ratio explanation.

## Accuracy means three different things

1. **Silhouette fidelity:** reproduce the visible reference outline. A calibrated bitmap-to-vector trace is the appropriate first method.
2. **Construction fidelity:** recover the underlying rods, centreline curves, collars, and overlapping joints. A photograph or scan often does not contain enough information to uniquely recover this.
3. **Style fidelity:** invent new ornaments that obey the same visual grammar. This needs explicit construction rules and controlled variation, followed by optical evaluation.

Combining these into one image-generation step loses the distinction. Diffusion may be useful for inspiration, but it does not inherently give reproducible topology, exact reflections, editable curves, or reliable vector export. A hybrid vector pipeline is the better foundation for this application.

## Recommended architecture

### Reference-preserving branch

Crop → orient and flatten → grayscale → user-controlled threshold → remove small components → Potrace → closed cubic Bézier outlines → compare the rasterised vector with the thresholded crop.

Potrace explicitly describes tracing as an inference: different outlines can produce the same bitmap. Higher resolution and an informed crop help, but tracing cannot recover absent information. The app exposes threshold, speckle cleanup, smoothing, and inverted foreground rather than hiding those decisions.

The implemented tracer supersamples the binary mask at 2× with nearest-neighbour sampling before contour fitting. It scales the resulting vector back to the original crop and evaluates intersection over union **at the original crop resolution**, avoiding a changed denominator. This improves boundary precision without pretending the scan contains new detail.

The reported metric is `intersection(foreground_source, foreground_trace) / union(foreground_source, foreground_trace)`. It measures agreement with the prepared mask, not the unknown pre-scan drawing or the beauty of the pattern. Cleanup can intentionally lower overlap by removing scan noise.

### Generative branch

Seed → construction-family selection → bounded geometric parameters → cubic Bézier primitives → reflected/rotated assembly → terminal and collar placement → catalogue composition → SVG or PNG.

The application implements six families: heart spindle, bound lyre, open diamond, quatrefoil, floral cartouche, and rosette panel. The same curve is transformed to create its counterparts, enforcing symmetry by construction rather than estimating it afterward. Breadth, height or lobe reach, curl character, line weight, and applicable terminals can be edited. Seeds are deterministic. A mixed sheet includes all six families before cycling through them again.

These are six procedural grammars with many continuous variations; the app does not claim unlimited new construction topologies or automatic learning from an arbitrary upload. “Explore this family” creates related grammar-based motifs. It does not mutate the uploaded outline or reconstruct its rods.

### Layout branch

The catalogue is the default because the user selected the first image's collection of different motifs. A separate repeat study places exact copies of the selected motif in a grid, optionally rotating alternate rows. Spacing, captions, and column count are adjustable. Repeat tiles remain separate ornaments; they are not automatically joined into continuous metalwork across tile boundaries.

## What would raise accuracy further

For a future construction-recovery mode:

1. Extract a foreground skeleton and local rod-width estimate from a distance transform.
2. Build a graph of endpoints, junctions, intersections, and cycles; distinguish a touching collar from a crossing rod with user correction.
3. Estimate mirror axes and rotational centres using contour or curve correspondences.
4. Classify candidate subcurves as C-scrolls, S-scrolls, arcs, collars, leaves, and rosettes.
5. Fit a low-dimensional family against both the image mask and the skeleton. A practical objective combines silhouette distance, centreline distance, curvature smoothness, symmetry error, minimum gap, and an explicit penalty for unintended intersections.
6. Show an editable reconstruction overlay and expose uncertainty at ambiguous junctions.
7. Rank generated candidates with gap, curvature, density, and silhouette-diversity measures, then calibrate those weights from the user's accepted and rejected designs.

This advanced fitting and ranking is **not implemented** in this version. A carefully corrected vector master and a richer hand-authored grammar remain the highest-control route when exact craft decisions matter.

## Local implementation

- React handles catalogue selection, controls, persistence, import, and export.
- SVG is the working representation and vector export format.
- Express serves the production build and a local tracing endpoint, bound to `127.0.0.1`.
- Sharp performs crop, orientation, image preparation, and mask comparison; Potrace performs outline fitting.
- The two supplied reference images are included locally. Ten cropped motif traces form the built-in archive.
- Images are processed on this computer. No external generation service or API key is used.

## Primary sources

- Peter Selinger, [Potrace: a polygon-based tracing algorithm](https://potrace.sourceforge.net/potrace.pdf). The main source for the contour-tracing pipeline and its fundamental limits.
- [node-potrace source and parameter documentation](https://github.com/tooolbox/node-potrace). The implementation used by the local service; GPL-2.0.
- [Detecting Symmetries and Curvilinear Arrangements in Vector Art](https://graphics.stanford.edu/~yitingy/papers/symmetry.pdf). Supports treating symmetry and arrangement as recoverable vector structure.
- [Paper.js: smoothing, simplifying and flattening](https://paperjs.org/tutorials/paths/smoothing-simplifying-flattening/). Useful guidance for future curve-editing tools; Paper.js itself is not a dependency of this build.
- [OpenCV image transformations](https://docs.opencv.org/4.12.0/d7/d1b/group__imgproc__misc.html). Thresholding and distance transforms for a future centreline branch; OpenCV is not a dependency of this build.
- [Symmetry preference in shapes, faces, flowers and landscapes](https://pubmed.ncbi.nlm.nih.gov/31245176/). Experimental evidence that symmetry preference depends on stimulus category.
- [Impact of contour on aesthetic judgments and approach-avoidance decisions in architecture](https://doi.org/10.1073/pnas.1301227110). Experimental evidence concerning curvature and beauty judgments, with scope limited to its study conditions.
- The Metropolitan Museum of Art, [Ironwork](https://resources.metmuseum.org/resources/metpublications/pdf/Ironwork_The_Metropolitan_Museum_of_Art_Bulletin_v_22_no_8_April_1964.pdf). Historical description of scroll shaping, templates, terminal treatment, and assembly.

## Hosted deployment

The GitHub Pages version traces images in the browser using [esm-potrace-wasm](https://github.com/tomayac/esm-potrace-wasm), with Canvas crop/threshold preparation and the same native-resolution overlap comparison. It retains Potrace's compound paths and output coordinate transforms, including the inverted y-axis, before scaling from the 2× mask. Browser tracing keeps images on the visitor's device and makes the hosted app independent of the optional Express/Sharp service. Source and deployed builds are published in the repository's `main` and `gh-pages` branches.
