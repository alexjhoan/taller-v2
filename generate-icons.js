const fs = require('fs');
const path = require('path');

// Create icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Simple SVG icon template for Mecaflow
const createIconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <g transform="translate(${size * 0.2}, ${size * 0.2}) scale(${size * 0.6 / 24})">
    <!-- Wrench icon -->
    <path d="M14.7 17.3c-.4.4-1 .4-1.4 0l-3.1-3.1a2.5 2.5 0 0 1 0-3.5L15.1 4.9a2.5 2.5 0 0 1 3.5 0l2.1 2.1c.4.4.4 1 0 1.4L11.3 22H7v-2h4.3l7.4-7.4-2.1-2.1c-.4-.4-1-.4-1.4 0L9.9 13.9a.75.75 0 0 0 0 1.1l2.1 2.1c.3.3.7.4 1.1.1l3.1-3.1c.2-.2.3-.5.1-.7L14.7 17.3Z" fill="white"/>
    <path d="M4.5 19.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5-.7-1.5-1.5-1.5-1.5.7-1.5 1.5Z" fill="#1d4ed8"/>
    <path d="M19.5 4.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5-.7-1.5-1.5-1.5-1.5.7-1.5 1.5Z" fill="#1d4ed8"/>
  </g>
</svg>`;

// Generate SVG files for each size
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = createIconSvg(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
  console.log(`Created icon-${size}x${size}.svg`);
});

// Also create a simple HTML file to convert SVGs to PNGs if needed
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Icon Generator</title>
</head>
<body>
  <div id="icons"></div>
  <script>
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    const container = document.getElementById('icons');
    sizes.forEach(size => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      // Load SVG and draw to canvas
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        // Save as PNG
        const link = document.createElement('a');
        link.download = 'icon-' + size + 'x' + size + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      const svg = \`<svg width="\${size}" height="\${size}" viewBox="0 0 \${size} \${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="\${size}" height="\${size}" rx="\${size * 0.2}" fill="url(#grad)"/>
        <g transform="translate(\${size * 0.2}, \${size * 0.2}) scale(\${size * 0.6 / 24})">
          <path d="M14.7 17.3c-.4.4-1 .4-1.4 0l-3.1-3.1a2.5 2.5 0 0 1 0-3.5L15.1 4.9a2.5 2.5 0 0 1 3.5 0l2.1 2.1c.4.4.4 1 0 1.4L11.3 22H7v-2h4.3l7.4-7.4-2.1-2.1c-.4-.4-1-.4-1.4 0L9.9 13.9a.75.75 0 0 0 0 1.1l2.1 2.1c.3.3.7.4 1.1.1l3.1-3.1c.2-.2.3-.5.1-.7L14.7 17.3Z" fill="white"/>
          <path d="M4.5 19.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5-.7-1.5-1.5-1.5-1.5.7-1.5 1.5Z" fill="#1d4ed8"/>
          <path d="M19.5 4.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5-.7-1.5-1.5-1.5-1.5.7-1.5 1.5Z" fill="#1d4ed8"/>
        </g>
      </svg>\`;
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    };
    container.appendChild(canvas);
  });
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(iconsDir, 'generate-icons.html'), htmlContent);
console.log('Created generate-icons.html - open in browser to generate PNG icons');