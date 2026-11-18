"""Generate the minimal brand icons with Python stdlib (for CI without Pillow)."""
from pathlib import Path
from struct import pack
import zlib

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'assets'
TARGET.mkdir(exist_ok=True)


def chunk(typ: bytes, data: bytes) -> bytes:
    return pack('!I', len(data)) + typ + data + pack('!I', zlib.crc32(typ + data) & 0xFFFFFFFF)


def image(name: str, size: int):
    # Deep navy background, bright blue dot and a bold white C-like glyph.
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            xx, yy = x / size, y / size
            base = (17, 29, 50)
            # A blocky native icon glyph 'C' made from an arc band.
            dx, dy = xx - 0.48, yy - 0.50
            r2 = dx * dx + dy * dy
            arc = 0.083 < r2 < 0.122 and (xx < 0.68 or (yy < 0.28 or yy > 0.72))
            dot = (xx - 0.75) ** 2 + (yy - 0.76) ** 2 < 0.014
            row.extend((61, 135, 245) if dot else ((255, 255, 255) if arc else base))
        rows.append(bytes(row))
    raw = b''.join(rows)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    (TARGET / name).write_bytes(png)


for name, size in [('icon.png', 1024), ('adaptive-icon.png', 1024), ('favicon.png', 192)]:
    image(name, size)
print('Generated icon assets.')
