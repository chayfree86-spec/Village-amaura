const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting build process...');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// 1. Build CSS using Tailwind CLI
console.log('Building Tailwind CSS...');
execSync('npx @tailwindcss/cli -i src/input.css -o dist/style.min.css --minify', { stdio: 'inherit' });

// 2. Build JS using esbuild
console.log('Building JS with esbuild...');
execSync('npx esbuild app.js --minify --outfile=dist/app.min.js', { stdio: 'inherit' });

// Helper to copy file
function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${src} to ${dest}`);
    } else {
        console.warn(`Warning: Source file ${src} does not exist!`);
    }
}

// 3. Copy other files to dist
copyFile('db.php', 'dist/db.php');
copyFile('api.php', 'dist/api.php');
copyFile('logo.png', 'dist/logo.png');
copyFile('pwa-icon.png', 'dist/pwa-icon.png');
copyFile('manifest.json', 'dist/manifest.json');

// 4. Copy and modify sw.js
console.log('Copying and modifying sw.js...');
if (fs.existsSync('sw.js')) {
    let swContent = fs.readFileSync('sw.js', 'utf8');
    swContent = swContent
        .replace("'./dist/style.min.css'", "'./style.min.css'")
        .replace("'./dist/app.min.js'", "'./app.min.js'");
    fs.writeFileSync('dist/sw.js', swContent, 'utf8');
    console.log('Generated dist/sw.js');
}

// 5. Copy and modify index.html
console.log('Copying and modifying index.html...');
if (fs.existsSync('index.html')) {
    let htmlContent = fs.readFileSync('index.html', 'utf8');
    htmlContent = htmlContent
        .replace('href="dist/style.min.css', 'href="style.min.css')
        .replace('src="dist/app.min.js', 'src="app.min.js');
    fs.writeFileSync('dist/index.html', htmlContent, 'utf8');
    console.log('Generated dist/index.html');
}

console.log('Build completed successfully!');
