<?php
// db.php - Database connection using PDO (compatible with pdo_mysql)
header('Content-Type: application/json; charset=utf-8');

// // Local DB Settings
// $host = 'localhost';
// $db_user = 'root';
// $db_pass = '';
// $db_name = 'prajapati_ekta';

// Live DB Settings
$host = 'localhost';
$db_user = 'u748421121_praj_ekta';
$db_pass = 'z@WY|N:1a5S^';
$db_name = 'u748421121_praj_ekta';


try {
    // Connect to MySQL server first using PDO
    $db = new PDO("mysql:host=$host", $db_user, $db_pass);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create database if not exists
    $db->exec("CREATE DATABASE IF NOT EXISTS `$db_name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // Connect to the specific database
    $db = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Create tables

    // 1. Members table
    $db->exec("CREATE TABLE IF NOT EXISTS `members` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL,
        `mobile` VARCHAR(15) UNIQUE NOT NULL,
        `pin` VARCHAR(10) DEFAULT NULL, -- Custom login PIN
        `status` TINYINT(1) DEFAULT 0, -- 0 = Disable, 1 = Enable member login
        `is_admin` TINYINT(1) DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // Add pin column if table already exists (migration)
    try {
        $db->exec("ALTER TABLE `members` ADD COLUMN `pin` VARCHAR(10) DEFAULT NULL AFTER `mobile`");
    } catch (PDOException $e) {
        // Column already exists, ignore
    }

    // 2. Contributions table
    $db->exec("CREATE TABLE IF NOT EXISTS `contributions` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL,
        `mobile` VARCHAR(15) DEFAULT NULL,
        `type` ENUM('cash', 'goods') NOT NULL,
        `date` DATE NOT NULL,
        `remark` TEXT DEFAULT NULL,
        `amount` DECIMAL(12, 2) DEFAULT NULL,
        `payment_mode` ENUM('cash', 'upi', 'bank') DEFAULT NULL,
        `item_name` VARCHAR(100) DEFAULT NULL,
        `quantity` DECIMAL(12, 2) DEFAULT NULL,
        `rate` DECIMAL(12, 2) DEFAULT NULL,
        `total_value` DECIMAL(12, 2) DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 3. Expenses table
    $db->exec("CREATE TABLE IF NOT EXISTS `expenses` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `amount` DECIMAL(12, 2) NOT NULL,
        `paid_to` VARCHAR(100) NOT NULL,
        `date` DATE NOT NULL,
        `description` TEXT DEFAULT NULL,
        `bill_image` VARCHAR(255) DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 4. Settings table
    $db->exec("CREATE TABLE IF NOT EXISTS `settings` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `setting_key` VARCHAR(50) UNIQUE NOT NULL,
        `setting_value` VARCHAR(255) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // Insert Default Settings if not exists
    $stmt = $db->prepare("INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES ('edit_locked', '0')");
    $stmt->execute();

    // Insert Default Admin if not exists
    $stmt = $db->prepare("SELECT id FROM `members` WHERE `mobile` = '9628717175'");
    $stmt->execute();
    if ($stmt->rowCount() == 0) {
        $ins = $db->prepare("INSERT INTO `members` (`name`, `mobile`, `status`, `is_admin`) VALUES ('Sandeep Prajapati', '9628717175', 1, 1)");
        $ins->execute();
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    exit;
}
?>