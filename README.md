# TapeX
TapeX is a lightweight JavaScript library for reading and analysing retro-computer tape image files directly in the browser. It's written in vanilla JavaScript and has no external dependencies.

It currently supports CAS, TAP and TZX/TSX files, providing a common block-based representation while preserving format-specific information. TapeX can also identify some of the semantic content stored in tape blocks, including MSX and ZX Spectrum headers.

An optional visual extension, **TapeX Viewers**, provides ready-to-use HTML visualisation of the blocks parsed by TapeX.

## Features

- Pure vanilla JavaScript with no external dependencies.
- Works directly with `ArrayBuffer` and `Uint8Array` data.
- Automatic detection of CAS, TAP and TZX/TSX tape images.
- Common block-based representation across supported formats.
- Access to both physical block information and recognised semantic content.
- Recognition of MSX and ZX Spectrum tape headers.
- Filename extraction from recognised MSX and ZX Spectrum headers.
- Optional **TapeX Viewers** extension for visualising tape contents in the browser.
- Entirely client-side: tape images never need to leave the user's browser.

## Supported tape formats

### CAS

MSX CAS images are parsed into headers and data blocks. TapeX currently recognises:

- ASCII files
- Tokenised BASIC programs
- Binary files
- Unknown/custom data

For recognised MSX headers, the original six-character filename is preserved.

### TAP

ZX Spectrum TAP images are parsed into header and data blocks. Recognised headers are semantically identified as:

- BASIC programs
- Numeric arrays
- Character arrays
- Code

Associated filenames and header parameters are also preserved.

### TZX / TSX

TapeX currently supports the following TZX block types:

| ID | Block type |
|---:|---|
| `0x10` | Standard Speed Data |
| `0x11` | Turbo Speed Data |
| `0x13` | Pulse Sequence |
| `0x20` | Pause or Stop |
| `0x30` | Text Description |
| `0x32` | Archive Info |
| `0x35` | Custom Info |
| `0x4B` | Kansas City Standard |

TapeX preserves the TZX block ID and the format-specific fields associated with each supported block.

## Usage

TapeX can be used directly in the browser without any external dependencies.

Include the core files:
```html
<script src="tapex-readers.js"></script>
<script src="tapex.js"></script>
```
Then create a TapeX instance from an ArrayBuffer or Uint8Array:
```javascript
const buffer = await file.arrayBuffer();
const tape = TapeX(buffer);

console.log(tape.getFormat());
console.log(tape.getVersion());
console.log(tape.getBlocks());
```
TapeX automatically detects the tape image format and parses its contents when the instance is created.

## TapeX API

### `TapeX(data)`

Creates and parses a tape image.

`data` can be an `ArrayBuffer` or a `Uint8Array`.

### `getFormat()`

Returns the detected tape image format:

- `"cas"`
- `"tap"`
- `"tzx"`

TSX files use the TZX structure and therefore return `"tzx"`.

### `getVersion()`

Returns the TZX/TSX format version.

Returns `null` for CAS and TAP images.

### `getBlocks()`

Returns the array of parsed tape blocks.

Each block contains its physical type and format-specific information. When TapeX recognises the semantic meaning of a block, this information is provided separately through `decodedType`.

### `getData(offset, size)`

Returns a view of `size` bytes from the original tape image starting at `offset`.

### `getHeader()`

Returns the bytes preceding the first tape block. This includes the file-format header when present.

## TapeX Viewers

**TapeX Viewers** is an optional extension that provides a ready-to-use visual representation of the blocks parsed by TapeX. Include its JavaScript and CSS files in addition to the TapeX core:
 ```html
 <link rel="stylesheet" href="tapex-viewers/tapex-viewers.css">
 <script src="tapex-readers.js"></script>
 <script src="tapex.js"></script>
 <script src="tapex-viewers/tapex-viewers.js"></script>
 ```
Create a viewer for a persistent container:
```html
<div id="TapeX"></div>
```
```javascript
const viewers = TapeXblockViewers(document.getElementById("TapeX"));
```
Then render the blocks returned by TapeX:
```javascript
const buffer = await file.arrayBuffer();
const tape = TapeX(buffer);

viewers.render(tape.getBlocks());
```
A viewer instance should normally be created once for its container and reused when loading different tape images.

## TapeX Viewers API

### `TapeXblockViewers(container)`

Creates a TapeX Viewers instance associated with a DOM container.

### `render(blocks)`

Renders an array of TapeX blocks in the associated container.

### `setPreviewSize(size)`

Sets the maximum number of data bytes displayed in the collapsed preview.

The default preview size is `64` bytes.

### Custom controls

Each rendered block includes an empty `.tapex-block-controls` element in its header. Applications can use this element to add their own block-specific controls without modifying TapeX Viewers.

The element also provides a `data-block` attribute containing the zero-based index of the corresponding block.

Controls added inside `.tapex-block-controls` do not trigger the default block open/close behaviour.

### Live demo

A browser-based demo of TapeX Viewers is included in the `tapex-viewers/demo` directory.

The demo allows local CAS, TAP and TZX/TSX files to be opened and inspected directly in the browser. Tape images are processed entirely client-side and are never uploaded to a server.

## Browser compatibility

TapeX is designed for modern web browsers with standard JavaScript, typed array and File API support.

No external libraries, frameworks or browser extensions are required.

## Roadmap

TapeX will continue to evolve incrementally, with priority given to compatibility with real-world tape images.

Planned areas of development include:

- Support for additional TZX/TSX block types.
- Improved semantic recognition of tape contents.
- Support for additional retro-computer tape formats.

The roadmap is intentionally flexible. Features and release order may change as new formats, tape images and edge cases are encountered.

## License

TapeX is free software released under the GNU Lesser General Public License v3.0 (LGPL-3.0-only). See the `LICENSE` file for the complete license text.

