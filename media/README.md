# Media

Screenshots already in place. To change one, replace the file with the same name.

| File | Where it shows |
|---|---|
| topdown-1.jpg | Top-down game page, main image |
| topdown-2.jpg, topdown-3.jpg | Top-down game page gallery |
| jam-fauxtelja-title.png, jam-fauxtelja-play.png | Cycle on the Fauxtelja card while hovered |
| jam-hoverbald-title.png, jam-hoverbald-play.png | Cycle on the HoverBald card while hovered |
| jam-mosquito-1.jpg, jam-mosquito-2.jpg | Cycle on the Not the Mosquito Again card while hovered |
| pupilprism-1.png, -2.png, -3.png | PupilPrism page, phone mockups |
| tenthousand-1.png, -2.png | TenThousand page, phone mockups |
| og-image.jpg | Preview image when the link is shared on LinkedIn |

The start screen background is drawn in code (js/background.js), so it needs no image.

Optional: add `topdown-clip.mp4` and it replaces the still image at the top of the
top-down game page. 16:9, 1280x720, H.264, no audio, under 10 MB. Record with OBS,
compress in HandBrake using "Fast 720p30" and remove the audio track. Until you add
it the browser logs a harmless 404 for that one file and uses the still image.

To add more screenshots to a game jam card, drop the file in here and add one more
`<img>` line inside that card's `jam-media` block in index.html, plus one `<span></span>`
in its `jam-dots`. The card will cycle through however many it finds.
