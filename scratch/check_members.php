<?php
require_once dirname(__DIR__) . '/db.php';
$res = $db->query("SELECT * FROM members")->fetchAll();
echo "MEMBERS:\n";
print_r($res);
?>
