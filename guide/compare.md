# Compare a design

Add the design, line it up with the page, then change how the two are drawn until the differences stand out.

## Add a design

Three ways, all into the panel:

- **Add image** opens a file picker.
- Drop one or more image files on the panel. Each becomes its own layer.
- Paste an image with <kbd>Ctrl</kbd>+<kbd>V</kbd> while the panel has focus.

A new layer goes on top of the others and becomes the active one. It is named after its file, starts at 50 % see-through, and is not locked.

Pixel Veil takes PNG, JPEG, WebP and GIF, up to 25 MB each. It refuses SVG, and says why in the panel.

**A design exported at 2x** (for a Retina screen) is twice the page's size. Click **½ (for @2x)** to draw it at half its size.

## Line it up

Each of these moves the *active* layer: the one marked in the list. Click a layer's name to make it active.

| How | What it does |
|---|---|
| Drag the layer | Moves it. Within 8 px of the page's left edge, right edge or top, it snaps to that edge. |
| Arrow keys | Move it 1 px; with <kbd>Shift</kbd>, 10 px. The page does not scroll. |
| **X** and **Y** | Type the position in page pixels. <kbd>Enter</kbd> applies it. |
| **Scale** | From 0.1 to 4 times the image's own size, in steps of 0.05. |
| **Center** | Centres the layer across the page's width. |
| **Fit width** | Scales the layer to the page's width and moves it to the left edge. |

> The arrow keys do nothing while you type in a text field, so typing never moves a layer. A locked layer does not move at all, and its **Center** and **Fit width** are off.

## See through it

**Opacity** sets how solid the active layer is: type a number from 0 to 100, or drag the slider. <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> makes it 10 % more solid, and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>,</kbd> 10 % more see-through.

## Compare in four ways

The **Blend mode** list sets how every layer on this site is drawn over the page.

| Mode | Use it to |
|---|---|
| **Normal** | See the design over the page, at the layer's opacity. |
| **Difference** | Find what differs. Pixels that match turn black; a shift of one pixel shows as a thin outline. |
| **Multiply** | See dark lines of both at once, such as text and borders on a light page. |
| **Screen** | The same for light lines on a dark page. |

The **Difference** button switches between Difference and Normal in one click. **Invert** flips the colours of the layers. At 50 % opacity, an inverted design turns every matching pixel grey: another way to see what differs.

## Show, hide and lock

- The eye button on a layer's row hides that layer, or shows it again.
- **Hide all** hides every layer and keeps the panel. <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> does the same.
- Clicking the toolbar icon again hides all layers; the next click shows them.
- **Lock** lets your clicks pass through the layer to the page under it, so you can use the page while the design stays in place.
