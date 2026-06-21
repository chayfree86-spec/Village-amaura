import os
from PIL import Image

def optimize_image(input_path, output_path, max_size=(256, 256)):
    try:
        with Image.open(input_path) as img:
            # Convert palette/RGBA images correctly
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Resize image maintaining aspect ratio
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Save optimized PNG
            img.save(output_path, 'PNG', optimize=True)
            print(f"Optimized {input_path} -> {output_path} (Size: {os.path.getsize(output_path)} bytes)")
    except Exception as e:
        print(f"Error optimizing {input_path}: {e}")

if __name__ == '__main__':
    public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
    
    logo_path = os.path.join(public_dir, 'logo.png')
    pwa_icon_path = os.path.join(public_dir, 'pwa-icon.png')
    
    # Optimize logo.png to max 256x256
    optimize_image(logo_path, logo_path, max_size=(256, 256))
    
    # Optimize pwa-icon.png to max 192x192
    optimize_image(pwa_icon_path, pwa_icon_path, max_size=(192, 192))
