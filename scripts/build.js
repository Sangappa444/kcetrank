const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    console.log('Building frontend...');
    execSync('npm install', { cwd: path.join(__dirname, '..', 'frontend'), stdio: 'inherit' });
    execSync('npm run build', { cwd: path.join(__dirname, '..', 'frontend'), stdio: 'inherit' });

    const rootDist = path.join(__dirname, '..', 'dist');
    const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

    if (fs.existsSync(rootDist)) {
        console.log('Cleaning old root dist directory...');
        fs.rmSync(rootDist, { recursive: true, force: true });
    }

    console.log('Copying build assets to root dist...');
    copyDirSync(frontendDist, rootDist);
    console.log('Build completed successfully!');
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}
