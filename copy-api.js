import fs from 'fs';
import path from 'path';

function copyFolderRecursiveSync(source, target) {
    let files = [];

    const targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
    }

    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            const curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                fs.copyFileSync(curSource, path.join(targetFolder, file));
                console.log(`Copied ${curSource} to ${path.join(targetFolder, file)}`);
            }
        });
    }
}

console.log('Copying api folder to dist/api...');
if (fs.existsSync('api')) {
    copyFolderRecursiveSync('api', 'dist');
    console.log('API directory successfully copied to dist/api!');
} else {
    console.error('Error: api/ directory does not exist!');
}

// Copy clear_opcache.php to dist/
if (fs.existsSync('clear_opcache.php')) {
    fs.copyFileSync('clear_opcache.php', path.join('dist', 'clear_opcache.php'));
    console.log('Copied clear_opcache.php to dist/clear_opcache.php');
}
