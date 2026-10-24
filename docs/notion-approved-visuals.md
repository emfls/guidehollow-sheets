# GuideHollow publishing: reviewed visual assets from Notion

## Purpose

A useful image can clarify a formula, decision, or series of steps. This workflow makes an image **part of the actual approved Notion article** without modifying the Astro template for each new publication. It does not generate images unattended. An editor creates and fact-checks visual assets before publication; GitHub Actions only validates and publishes already approved work.

## Editorial process

1. Choose the part of an article that actually benefits from a diagram. If the prose and worked example are clearer alone, **do not add an image**. The publisher supports zero images.
2. Create a small, original, self-contained SVG. Check every formula, number, and label against the article's factual or fictional example. Don't depict simulated UI as a genuine screenshot. Hyperframes may be used separately to prototype animations, but a rendered video is **not** accepted by this SVG-only publisher.
3. Save the vetted SVG as \`public/visuals/descriptive-name.svg\` in this repository. File names must contain lowercase letters, numbers, or hyphens. Commit it through the normal GitHub PR/review/build process **before** adding it to the Notion article.
4. Open its public URL after deploy: \`https://sheets.guidehollow.com/visuals/descriptive-name.svg\`. For this repository, use the real current site's hostname. The URL must not contain query parameters or fragments.
5. In Notion, insert a native **Image** block **using an external URL**, not a Notion-uploaded file, and paste the verified URL. In the image caption, enter **exactly three lines**:

   \`\`\`text
   Alt: A clear, specific description of the information shown in the diagram.
   Caption: A short explanation of the example, result, and reason this picture helps.
   Credit: Original GuideHollow editorial diagram based on fictional teaching data.
   \`\`\`

   - \`Alt:\` must be 30–240 characters and describe the visible information, not say merely "image" or "diagram".
   - \`Caption:\` must be 25–360 characters and explain the meaning in context.
   - \`Credit:\` must be 10–180 characters and truthfully describe the origin or license. Do not claim external charts or screenshots are original.
   - Other text (including code, formulas, instructions, sources and cautions) remains as normal Notion blocks.
6. Review the actual article and image together. Only then set the normal Notion article approval and scheduled date. Never modify the existing site relation, workflow, rate limit, or ledger.
7. At dispatch, the Python publisher converts the approved image block into a responsive \`<figure>\` with dimensions, alt text, caption and credit. The exact SHA-256 digest of the local SVG is embedded in its HTML source. This means changes to the illustration change the staged article revision instead of silently reusing the same illustration reference.
8. CI runs publisher regression tests and the full Astro build. Any missing local file, unsafe SVG, remote image, malformed caption, unsupported Notion file upload, or expiring image URL **stops staging** with \`VISUAL_REVIEW_REQUIRED\`. Do not suppress that check to meet a publishing schedule. Fix the image or remove it and approve the article again.
9. Check the published article at a mobile width, confirm its caption, explanatory alt text and reachable graphic, and record what was verified. A passing workflow does **not** establish native Excel/Sheets or real AI product testing.

## Technical limitations and protections

- Accepts only an external URL at this site's own \`/visuals/descriptive-name.svg\` path, backed by a file already committed to \`public/visuals\`.
- Rejects Notion-hosted expiring uploads, other origins, URL queries, fragments, traversal paths, missing SVG files, and files over 60 KB.
- Parses SVG XML; rejects unsafe tags (scripts, active SVG animations, foreign objects and linked elements), event handlers, inline styles, external references and styles with \`url(...)\`. Requires a 0-based \`viewBox\` with supported width/height.
- All alt, caption and credit values are HTML-escaped. No arbitrary pasted HTML or Markdown from those fields is rendered.
- Existing article template diagrams are left as-is. Future approved Notion article images use the image-block path instead.
- Does not run Hyperframes, automatically generate an SVG, source photographs, manipulate copyright permissions, or bypass any publication approval.
- The GitHub commit and public asset are the authoritative visual. Merely attaching a picture to Notion is not sufficient.

## Example for a Sheets formula explanation

\`\`\`text
Alt: The wrong VLOOKUP column index returns a reference error, while IFERROR masks it with fallback text.
Caption: Compare IFNA and IFERROR before choosing which errors to hide in your workbook.
Credit: GuideHollow Sheets original illustration of documented formula behavior.
\`\`\`

A screenshot is useful when the exact real UI matters, but it needs its own license, version and capture evidence. The current pipeline rejects screenshots until a separate, safe asset workflow exists.

## Rollback and recovery

The approved SVG file stays in GitHub; do not delete it once a published article references it. For a staged Sheets article, changes to the asset affect the hashed generated Markdown and will fail recovery checks rather than silently finalize the wrong version. Use a revised asset filename for updated screenshots or figures and follow normal approval/publication changes. A run that returns \`QUEUE_EMPTY\` or \`DAILY_LIMIT\` is expected when no approved due article is available.
