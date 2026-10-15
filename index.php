<?php
/**
 * Techrey Digital - Entry Point & Fail-safe Router for LiteSpeed / Hostinger Shared Hosting
 *
 * This file guarantees that public_html always has a valid DirectoryIndex file,
 * preventing "403 Forbidden" errors even if mod_rewrite is not active or during
 * direct directory lookups.
 */

$appDistDir = __DIR__ . '/app/dist';
$appDistIndex = $appDistDir . '/index.html';
$prototypeIndex = __DIR__ . '/prototype/index.html';

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// Helper to send correct MIME types
function sendMimeHeader($file) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mimes = [
        'html'  => 'text/html; charset=UTF-8',
        'js'    => 'application/javascript; charset=UTF-8',
        'mjs'   => 'application/javascript; charset=UTF-8',
        'css'   => 'text/css; charset=UTF-8',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'webp'  => 'image/webp',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'json'  => 'application/json',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf'
    ];
    if (isset($mimes[$ext])) {
        header('Content-Type: ' . $mimes[$ext]);
    }
}

// 1. Primary: If app/dist/index.html exists (Vite build is present)
if (file_exists($appDistIndex)) {
    // If request is for an asset file inside app/dist/
    if ($requestPath !== '/' && $requestPath !== '') {
        $candidate = $appDistDir . $requestPath;
        if (file_exists($candidate) && !is_dir($candidate)) {
            sendMimeHeader($candidate);
            header('Cache-Control: public, max-age=31536000, immutable');
            readfile($candidate);
            exit;
        }
    }

    // Serve SPA index.html for all page routes
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    readfile($appDistIndex);
    exit;
}

// 2. Fallback: If app/dist is not built yet, serve prototype/
if (file_exists($prototypeIndex)) {
    if ($requestPath !== '/' && $requestPath !== '') {
        $protoCandidate = __DIR__ . '/prototype' . $requestPath;
        if (file_exists($protoCandidate) && !is_dir($protoCandidate)) {
            sendMimeHeader($protoCandidate);
            readfile($protoCandidate);
            exit;
        }
    }

    header('Content-Type: text/html; charset=UTF-8');
    readfile($prototypeIndex);
    exit;
}

// 3. Last resort if neither exists
http_response_code(503);
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Techrey Digital — Sedang Disiapkan</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f5f5f3; color: #1a1a1a; display: grid; place-items: center; min-height: 80vh; margin: 0; text-align: center; }
        .box { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); max-width: 500px; }
        h1 { color: #2854ff; margin-top: 0; }
        code { background: #eef2fa; padding: 2px 6px; border-radius: 4px; font-size: .9em; }
    </style>
</head>
<body>
    <div class="box">
        <h1>Techrey Digital</h1>
        <p>Aplikasi web sedang disiapkan untuk rilis pertama.</p>
        <p>Jalankan <code>npm run build</code> di dalam folder <code>app/</code> lalu commit folder <code>app/dist/</code> ke Git.</p>
    </div>
</body>
</html>
