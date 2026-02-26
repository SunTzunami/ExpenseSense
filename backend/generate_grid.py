from PIL import Image, ImageDraw
import os

def create_grid(cell_size, cols, rows, filename):
    width = cell_size * cols
    height = cell_size * rows
    
    os.makedirs("data", exist_ok=True)

    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for x in range(0, width + 1, cell_size):
        draw.line([(x, 0), (x, height)], fill=(0, 0, 0, 255), width=1)

    for y in range(0, height + 1, cell_size):
        draw.line([(0, y), (width, y)], fill=(0, 0, 0, 255), width=1)

    img.save(f"data/{filename}")

create_grid(32, 4, 4, "grid_32px_4x4.png")