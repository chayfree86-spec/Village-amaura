<?php
header('Content-Type: text/plain; charset=utf-8');
if (function_exists('opcache_reset')) {
    echo opcache_reset() ? "OPcache reset successful! (कैश सफलतापूर्वक साफ़ हो गया)" : "OPcache reset failed. (कैश साफ़ नहीं हो सका)";
} else {
    echo "OPcache is not enabled. (OPcache सक्रिय नहीं है)";
}
