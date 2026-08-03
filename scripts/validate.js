const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const manifest = json('manifest.json');
const pkg = json('package.json');
const content = read('src/content/content.js');
const background = read('src/background/background.js');
const popup = read('src/popup/popup.js');
const popupHtml = read('src/popup/popup.html');

const failures = [];
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};

assert(manifest.manifest_version === 3, 'manifest_version must be 3');
assert(manifest.version === pkg.version, 'manifest and package versions must match');
assert(manifest.background?.service_worker === 'src/background/background.js', 'background service worker path is unexpected');
assert(manifest.content_security_policy?.extension_pages?.includes("connect-src 'none'"), "extension CSP must include connect-src 'none'");

const permissions = new Set([
    ...(manifest.permissions || []),
    ...(manifest.host_permissions || [])
]);
for (const forbidden of ['tabs', 'cookies', 'history', 'webRequest', 'downloads', '<all_urls>']) {
    assert(!permissions.has(forbidden), `forbidden permission declared: ${forbidden}`);
}

const matches = manifest.content_scripts?.flatMap(script => script.matches || []) || [];
assert(matches.length > 0, 'content script must declare explicit matches');
for (const match of matches) {
    assert(/youtube\.com\/\*$/.test(match), `content script match is not scoped to youtube.com: ${match}`);
    assert(!match.includes('*.youtube.com'), 'content script must avoid broad *.youtube.com scope');
}

for (const [file, source] of Object.entries({
    'src/content/content.js': content,
    'src/background/background.js': background,
    'src/popup/popup.js': popup
})) {
    assert(!/\beval\s*\(/.test(source), `${file} uses eval`);
    assert(!/new\s+Function\s*\(/.test(source), `${file} uses new Function`);
    assert(!/innerHTML\s*=/.test(source), `${file} writes innerHTML`);
}

assert(!/\.value\b/.test(content), 'production content script must not read DOM values');
assert(!/addEventListener\s*\(\s*['"](?:keydown|input|change)['"]/.test(content), 'production content script must not attach input-capture listeners');
assert(/sanitizeDetail/.test(background), 'background audit log must sanitize message details');
assert(/settings-panel/.test(popupHtml), 'popup settings panel is missing');
assert(/GET_AUDIT_LOG/.test(popup), 'popup must expose audit log status');

if (failures.length) {
    console.error('Validation failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('Mute Tube validation passed.');
