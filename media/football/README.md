# Homepage football clips

The homepage football has 20 hexagon faces and supports separate looping media for each face.

1. Add up to 20 short, muted-friendly clips to this directory (for example `01.mp4` through `20.mp4`) or add animated GIFs.
2. Edit `js/ui/homepage-football.js` and populate `CLIPS` in the same order, for example:

   ```js
   const CLIPS = [
     "media/football/01.mp4",
     "media/football/02.gif",
     "media/football/03.webm"
   ];
   ```

3. Clips map in order across the 20 hexagons. Unconfigured faces use existing local player portraits as a subtle fallback.

Prefer short, compressed MP4/WebM loops (muted playback) for performance. Twenty GIFs or high-resolution videos can consume considerable CPU, memory, bandwidth, and battery. Only use media you have permission to publish.
