# Workflow Templates (Compact)

Use these as defaults, then adapt to user intent and existing canvas.

## 1) Text -> Image
- Nodes: `prompt` -> `generateImage`
- Run: `executeNodeIds = [generateImage]`

## 2) Variations / A-B / Moodboard
- Nodes: 2-3 branches ending in `generateImage` (+ optional `imageCompare`)
- Rule: one prompt node per branch if wording differs
- Run all branch generation nodes

## 3) Image -> Video
- Nodes: `mediaInput` (or existing image source) -> `generateVideo`
- Add motion/camera prompt on video node
- Run video node

## 4) Full pipeline (Text -> Image -> Video)
- Stage 1: prompt -> generateImage, run image
- Stage 2: image output -> generateVideo, run video

## 5) Reference image edit
- Nodes: `mediaInput` -> `generateImage` (image-conditioned)
- Prompt should state preserve vs transform
- Run image node

## 6) Audio generation
- Nodes: `prompt` -> `generateAudio`
- Run audio node

## 7) 3D generation
- Nodes: source (`prompt` or `mediaInput`) -> `generate3d` -> `glbViewer`
- Run `generate3d`

## Layout defaults
- Left to right: source -> planning -> generation -> output
- Horizontal spacing ~350-450px
- Vertical spacing ~180-240px for branches
- Group related branches or multi-stage pipelines
