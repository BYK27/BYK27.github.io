# Media

To change a screenshot, replace the file and keep the same name.

| File | Where it shows |
|---|---|
| og-image.jpg | Preview image when the link is shared (LinkedIn, Discord…) |
| topdown-1.jpg | Top-down page, main image. Also on the TV |
| topdown-2.jpg, topdown-3.jpg | Top-down page gallery. Also on the TV |
| jam-fauxtelja-play.png, jam-hoverbald-play.png, jam-mosquito-1.jpg | Game jams page. Also on the TV |
| jam-fauxtelja-title.png, jam-hoverbald-title.png, jam-mosquito-2.jpg | "More screens" row on the jams page |
| pupilprism-1.png, -2.png, -3.png | PupilPrism page, phone screens (1 is also on the TV) |
| tenthousand-1.png, -2.png | TenThousand page, phone screens (1 is also on the TV) |
| background.jpg | Not used by the new design; safe to delete |

The TV on the start screen cycles through the images listed in `reelImages` at the top of
the screen section in `js/main.js`. Add or remove paths there.

Optional:

| File | Effect |
|---|---|
| topdown-clip.mp4 | Replaces the still image at the top of the top-down page. 16:9, 1280×720, H.264, no audio, under 10 MB |

Until you add the clip, the browser logs a harmless 404 for `topdown-clip.mp4` when that page opens.
