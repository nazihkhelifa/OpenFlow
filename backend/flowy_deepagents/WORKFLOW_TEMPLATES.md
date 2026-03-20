# Workflow Templates

Reference patterns for common creative pipelines. Use these as starting points when the user's goal matches a pattern — customize prompts, models, and settings based on user intent.

## Template: Text to Image (basic)
**When to use:** User wants to generate an image from a description.
**Nodes:** prompt → generateImage
**Pattern:**
1. `addNode` prompt at (200, 300), set `data.prompt` to the crafted prompt
2. `addNode` generateImage at (600, 300)
3. `addEdge` prompt.text → generateImage.text
4. `executeNodeIds`: [generateImage id]

## Template: Text to Image with Variations
**When to use:** User wants multiple options, A/B testing, moodboard.
**Nodes:** prompt → 2-3× generateImage → imageCompare
**Pattern:**
1. `addNode` prompt at (200, 300)
2. `addNode` generateImage ×2-3 at (600, 200), (600, 400), (600, 600) — vary model or prompt suffix
3. `addEdge` prompt.text → each generateImage.text
4. `addNode` imageCompare at (1000, 400)
5. `addEdge` each generateImage.image → imageCompare.image
6. `executeNodeIds`: [all generateImage ids]

## Template: Image to Video
**When to use:** User wants to animate an existing image.
**Nodes:** mediaInput (or existing image node) → generateVideo
**Pattern:**
1. If source image exists: use existing node. If uploaded: `addNode` mediaInput at (200, 300) with `data.mode = "image"`
2. `addNode` generateVideo at (600, 300)
3. `addEdge` sourceImage.image → generateVideo.image
4. Set `data.prompt` on generateVideo with motion/camera description
5. `executeNodeIds`: [generateVideo id]

## Template: Full Creative Pipeline (text → image → video)
**When to use:** User wants end-to-end creative production from a concept.
**Nodes:** prompt → generateImage → generateVideo
**Pattern:**
1. `addNode` prompt at (200, 300), set `data.prompt` to scene/concept description
2. `addNode` generateImage at (600, 300)
3. `addEdge` prompt.text → generateImage.text
4. `addNode` generateVideo at (1000, 300)
5. `addEdge` generateImage.image → generateVideo.image
6. Set `data.prompt` on generateVideo with motion/pacing
7. Stage 1 `executeNodeIds`: [generateImage id]
8. After image ready, Stage 2 `executeNodeIds`: [generateVideo id]

## Template: Reference Image Edit
**When to use:** User provides an image and wants modifications.
**Nodes:** mediaInput → generateImage (with reference)
**Pattern:**
1. `addNode` mediaInput at (200, 300) with `data.mode = "image"` (or use existing)
2. `addNode` generateImage at (600, 300), set model to `seedream` for controlled editing
3. `addEdge` mediaInput.image → generateImage.image (reference input)
4. Set `data.prompt` on generateImage describing the desired edit
5. `executeNodeIds`: [generateImage id]

## Template: Moodboard / Style Exploration
**When to use:** User wants to explore different styles, aesthetics, or directions.
**Nodes:** prompt → 3× generateImage (varied styles) → imageCompare
**Pattern:**
1. `addNode` prompt at (200, 400)
2. `addNode` generateImage ×3 at (600, 200), (600, 400), (600, 600) with different style/model combos
3. `addEdge` prompt.text → each generateImage.text
4. `addNode` imageCompare at (1000, 400)
5. `addEdge` each generateImage.image → imageCompare.image
6. `createGroup` for all generateImage nodes, name "Style Exploration"
7. `executeNodeIds`: [all generateImage ids]

## Template: Multi-Stage Campaign (Product Ad)
**When to use:** User wants a product ad, social content, or campaign assets.
**Nodes:** mediaInput → prompt (analysis) → generateImage (hero) → generateImage (variants) → generateVideo
**Pattern:**
1. `addNode` mediaInput at (100, 300) — product photo
2. `addNode` prompt at (450, 300) — analyze product, write ad copy
3. `addEdge` mediaInput.image → prompt.image (reference)
4. `addNode` generateImage at (800, 200) — hero shot
5. `addNode` generateImage at (800, 450) — alternate angle/style
6. `addEdge` prompt.text → each generateImage.text
7. `addEdge` mediaInput.image → each generateImage.image (reference fidelity)
8. `addNode` generateVideo at (1150, 300) — product video
9. `addEdge` best generateImage.image → generateVideo.image
10. `createGroup` name "Product Campaign"

## Template: Audio Generation
**When to use:** User wants sound effects, music, or audio content.
**Nodes:** prompt → generateAudio
**Pattern:**
1. `addNode` prompt at (200, 300), set `data.prompt` to audio description
2. `addNode` generateAudio at (600, 300)
3. `addEdge` prompt.text → generateAudio.text
4. `executeNodeIds`: [generateAudio id]

## Template: 3D Asset Generation
**When to use:** User wants 3D models or assets.
**Nodes:** prompt/mediaInput → generate3d → glbViewer
**Pattern:**
1. `addNode` prompt at (200, 300) or mediaInput with reference image
2. `addNode` generate3d at (600, 300)
3. `addEdge` source.text/image → generate3d input
4. `addNode` glbViewer at (1000, 300)
5. `addEdge` generate3d.3d → glbViewer.3d
6. `executeNodeIds`: [generate3d id]

## Layout Guidelines
- Standard horizontal spacing: ~400px between stages
- Standard vertical spacing: ~200px between parallel paths
- Keep related nodes grouped visually
- Left-to-right flow: input → processing → output
- When branching: fan out vertically, converge at comparison/output node
