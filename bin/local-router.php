<?php
// Local game server: expose only the public directory, without Composer or a database.
$public = dirname(__DIR__).'/public';
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if ($path === '/' || $path === '/index.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile($public.'/index.html');
    return true;
}
$file = realpath($public.$path);
if ($file && strpos($file, $public.DIRECTORY_SEPARATOR) === 0 && is_file($file)
    && in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['css', 'js', 'json', 'svg', 'png', 'ico'], true)) {
    return false;
}
http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Страница не найдена';
