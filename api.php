<?php
// api.php - REST API for Prajapati Ekta Group using PDO

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db.php'; // Defines $db as PDO object

// Helper to get JSON input
function get_json_input() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

// Helper to verify user and check if they are active
function check_auth($db, $mobile) {
    if (empty($mobile)) return null;
    $stmt = $db->prepare("SELECT * FROM `members` WHERE `mobile` = ?");
    $stmt->execute([$mobile]);
    $user = $stmt->fetch();
    if ($user) {
        if ($user['status'] == 1) {
            return $user; // User exists and is active
        }
    }
    return null;
}

// Helper to check if edit mode is locked
function is_edit_locked($db) {
    $stmt = $db->query("SELECT `setting_value` FROM `settings` WHERE `setting_key` = 'edit_locked'");
    $row = $stmt->fetch();
    if ($row) {
        return $row['setting_value'] == '1';
    }
    return false;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'get_data':
        // 1. Get Settings
        $edit_locked = is_edit_locked($db);

        // 2. Calculate Dashboard Summaries
        // Cash Donation
        $res = $db->query("SELECT SUM(amount) as total FROM contributions WHERE type = 'cash'")->fetch();
        $total_cash = (float)($res['total'] ?? 0.0);

        // Goods Donation
        $res = $db->query("SELECT SUM(total_value) as total FROM contributions WHERE type = 'goods'")->fetch();
        $total_goods = (float)($res['total'] ?? 0.0);

        // Total Collection
        $total_collection = $total_cash + $total_goods;

        // Total Expense
        $res = $db->query("SELECT SUM(amount) as total FROM expenses")->fetch();
        $total_expense = (float)($res['total'] ?? 0.0);

        // Balance
        $current_balance = $total_collection - $total_expense;

        // 3. Get Recent Activity Feed (Limit 30)
        $feed = [];
        
        $cont_res = $db->query("SELECT id, name, type, date, amount, total_value, item_name, 'contribution' as feed_type FROM contributions ORDER BY date DESC, id DESC LIMIT 50");
        while ($row = $cont_res->fetch()) {
            $feed[] = [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'type' => $row['type'],
                'date' => $row['date'],
                'amount' => (float)$row['amount'],
                'total_value' => (float)$row['total_value'],
                'item_name' => $row['item_name'],
                'feed_type' => 'contribution',
                'timestamp' => strtotime($row['date'] . ' 12:00:00') + $row['id']
            ];
        }

        $exp_res = $db->query("SELECT id, paid_to as name, amount, date, description, 'expense' as feed_type FROM expenses ORDER BY date DESC, id DESC LIMIT 50");
        while ($row = $exp_res->fetch()) {
            $feed[] = [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'type' => 'expense',
                'date' => $row['date'],
                'amount' => (float)$row['amount'],
                'total_value' => 0.0,
                'item_name' => $row['description'],
                'feed_type' => 'expense',
                'timestamp' => strtotime($row['date'] . ' 12:00:00') + $row['id']
            ];
        }

        // Sort feed by timestamp descending
        usort($feed, function($a, $b) {
            return $b['timestamp'] <=> $a['timestamp'];
        });
        
        // Limit feed to top 30
        $feed = array_slice($feed, 0, 30);

        // 4. Get Contributions List
        $contributions = [];
        $cont_all = $db->query("SELECT * FROM contributions ORDER BY date DESC, id DESC");
        while ($row = $cont_all->fetch()) {
            $row['id'] = (int)$row['id'];
            $row['amount'] = $row['amount'] !== null ? (float)$row['amount'] : null;
            $row['quantity'] = $row['quantity'] !== null ? (float)$row['quantity'] : null;
            $row['rate'] = $row['rate'] !== null ? (float)$row['rate'] : null;
            $row['total_value'] = $row['total_value'] !== null ? (float)$row['total_value'] : null;
            $contributions[] = $row;
        }

        // 5. Get Expenses List
        $expenses = [];
        $exp_all = $db->query("SELECT * FROM expenses ORDER BY date DESC, id DESC");
        while ($row = $exp_all->fetch()) {
            $row['id'] = (int)$row['id'];
            $row['amount'] = (float)$row['amount'];
            $expenses[] = $row;
        }

        // 6. Get Members List
        $members = [];
        $memb_all = $db->query("SELECT id, name, mobile, status, is_admin FROM members ORDER BY id ASC");
        while ($row = $memb_all->fetch()) {
            $row['id'] = (int)$row['id'];
            $row['status'] = (int)$row['status'];
            $row['is_admin'] = (int)$row['is_admin'];
            
            // Calculate member cash and goods total
            $m_mobile = $row['mobile'];
            
            $m_cash_res = $db->prepare("SELECT SUM(amount) as total FROM contributions WHERE mobile = ? AND type = 'cash'");
            $m_cash_res->execute([$m_mobile]);
            $mc_row = $m_cash_res->fetch();
            $row['cash_total'] = (float)($mc_row['total'] ?? 0.0);

            $m_goods_res = $db->prepare("SELECT SUM(total_value) as total FROM contributions WHERE mobile = ? AND type = 'goods'");
            $m_goods_res->execute([$m_mobile]);
            $mg_row = $m_goods_res->fetch();
            $row['goods_total'] = (float)($mg_row['total'] ?? 0.0);
            
            $row['overall_total'] = $row['cash_total'] + $row['goods_total'];

            $members[] = $row;
        }

        echo json_encode([
            "success" => true,
            "dashboard" => [
                "total_cash" => $total_cash,
                "total_goods" => $total_goods,
                "total_collection" => $total_collection,
                "total_expense" => $total_expense,
                "current_balance" => $current_balance
            ],
            "edit_locked" => $edit_locked,
            "feed" => $feed,
            "contributions" => $contributions,
            "expenses" => $expenses,
            "members" => $members
        ]);
        break;

    case 'login':
        $data = get_json_input();
        $mobile = trim($data['mobile'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($mobile) || empty($password)) {
            echo json_encode(["success" => false, "error" => "कृपया मोबाइल नंबर और पासवर्ड दर्ज करें।"]);
            exit;
        }

        // Fetch member
        $stmt = $db->prepare("SELECT * FROM members WHERE mobile = ?");
        $stmt->execute([$mobile]);
        $user = $stmt->fetch();

        if ($user) {
            // Check status (login disabled?)
            if ($user['status'] == 0) {
                echo json_encode(["success" => false, "error" => "आपका लॉगिन एक्सेस एडमिन द्वारा ब्लॉक कर दिया गया है।"]);
                exit;
            }

            // Verify Password
            $authenticated = false;
            if ($user['mobile'] === '9628717175') {
                // Admin specific password
                if ($password === '1986') {
                    $authenticated = true;
                }
            } else {
                // Member password is last 4 digits of mobile
                $last_four = substr($user['mobile'], -4);
                if ($password === $last_four) {
                    $authenticated = true;
                }
            }

            if ($authenticated) {
                echo json_encode([
                    "success" => true,
                    "user" => [
                        "id" => (int)$user['id'],
                        "name" => $user['name'],
                        "mobile" => $user['mobile'],
                        "is_admin" => (int)$user['is_admin']
                    ]
                ]);
            } else {
                echo json_encode(["success" => false, "error" => "गलत पासवर्ड।"]);
            }
        } else {
            echo json_encode(["success" => false, "error" => "यह मोबाइल नंबर पंजीकृत नहीं है।"]);
        }
        break;

    case 'add_contribution':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $name = trim($data['name'] ?? '');
        $mobile = trim($data['mobile'] ?? '');
        $type = trim($data['type'] ?? 'cash'); // cash or goods
        $date = trim($data['date'] ?? '');
        $remark = trim($data['remark'] ?? '');

        // Verify user session
        $user = check_auth($db, $user_mobile);
        if (!$user) {
            echo json_encode(["success" => false, "error" => "अनधिकृत एक्सेस (Unauthorized). कृपया फिर से लॉगिन करें।"]);
            exit;
        }

        // Check if edit is locked
        if (is_edit_locked($db) && !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "सिस्टम एडमिन द्वारा लॉक कर दिया गया है। आप प्रविष्टि नहीं जोड़ सकते।"]);
            exit;
        }

        if (empty($name) || empty($date)) {
            echo json_encode(["success" => false, "error" => "नाम और तारीख आवश्यक हैं।"]);
            exit;
        }

        if ($type === 'cash') {
            $amount = (float)($data['amount'] ?? 0);
            $payment_mode = trim($data['payment_mode'] ?? 'cash');

            if ($amount <= 0) {
                echo json_encode(["success" => false, "error" => "कृपया वैध नकद राशि दर्ज करें।"]);
                exit;
            }

            $stmt = $db->prepare("INSERT INTO contributions (name, mobile, type, date, remark, amount, payment_mode) VALUES (?, ?, 'cash', ?, ?, ?, ?)");
            $success = $stmt->execute([$name, $mobile, $date, $remark, $amount, $payment_mode]);
        } else {
            $item_name = trim($data['item_name'] ?? '');
            $quantity = (float)($data['quantity'] ?? 0);
            $rate = (float)($data['rate'] ?? 0);
            $total_value = $quantity * $rate; // Backend verified calculation

            if (empty($item_name) || $quantity <= 0 || $rate <= 0) {
                echo json_encode(["success" => false, "error" => "सामग्री का नाम, मात्रा और दर सही ढंग से दर्ज करें।"]);
                exit;
            }

            $stmt = $db->prepare("INSERT INTO contributions (name, mobile, type, date, remark, item_name, quantity, rate, total_value) VALUES (?, ?, 'goods', ?, ?, ?, ?, ?, ?)");
            $success = $stmt->execute([$name, $mobile, $date, $remark, $item_name, $quantity, $rate, $total_value]);
        }

        if ($success) {
            echo json_encode(["success" => true, "message" => "योगदान सफलता पूर्वक जोड़ा गया।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "योगदान जोड़ने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'add_expense':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $amount = (float)($data['amount'] ?? 0);
        $paid_to = trim($data['paid_to'] ?? '');
        $date = trim($data['date'] ?? '');
        $description = trim($data['description'] ?? '');
        $bill_image = trim($data['bill_image'] ?? ''); // base64 string

        // Verify user session
        $user = check_auth($db, $user_mobile);
        if (!$user) {
            echo json_encode(["success" => false, "error" => "अनधिकृत एक्सेस।"]);
            exit;
        }

        // Check if edit is locked
        if (is_edit_locked($db) && !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "सिस्टम लॉक है। आप खर्च नहीं जोड़ सकते।"]);
            exit;
        }

        if ($amount <= 0 || empty($paid_to) || empty($date)) {
            echo json_encode(["success" => false, "error" => "राशि, भुगतान पाने वाले का नाम और तारीख आवश्यक हैं।"]);
            exit;
        }

        $image_path = null;
        if (!empty($bill_image)) {
            // Save base64 image
            $image_parts = explode(";base64,", $bill_image);
            if (count($image_parts) == 2) {
                $image_type_aux = explode("image/", $image_parts[0]);
                $image_type = $image_type_aux[1] ?? 'png';
                $image_base64 = base64_decode($image_parts[1]);
                
                $filename = 'bill_' . uniqid() . '.' . $image_type;
                $upload_dir = 'uploads/';
                if (!file_exists($upload_dir)) {
                    mkdir($upload_dir, 0777, true);
                }
                
                if (file_put_contents($upload_dir . $filename, $image_base64)) {
                    $image_path = $upload_dir . $filename;
                }
            }
        }

        $stmt = $db->prepare("INSERT INTO expenses (amount, paid_to, date, description, bill_image) VALUES (?, ?, ?, ?, ?)");
        $success = $stmt->execute([$amount, $paid_to, $date, $description, $image_path]);

        if ($success) {
            echo json_encode(["success" => true, "message" => "खर्च सफलता पूर्वक जोड़ा गया।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "खर्च जोड़ने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'update_contribution':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $id = (int)($data['id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $mobile = trim($data['mobile'] ?? '');
        $type = trim($data['type'] ?? 'cash'); // cash or goods
        $date = trim($data['date'] ?? '');
        $remark = trim($data['remark'] ?? '');

        // Verify user session
        $user = check_auth($db, $user_mobile);
        if (!$user) {
            echo json_encode(["success" => false, "error" => "अनधिकृत एक्सेस।"]);
            exit;
        }

        // Check if edit is locked
        if (is_edit_locked($db) && !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "सिस्टम लॉक है। आप संपादन नहीं कर सकते।"]);
            exit;
        }

        if ($id <= 0 || empty($name) || empty($date)) {
            echo json_encode(["success" => false, "error" => "नाम, तारीख और आईडी आवश्यक हैं।"]);
            exit;
        }

        if ($type === 'cash') {
            $amount = (float)($data['amount'] ?? 0);
            $payment_mode = trim($data['payment_mode'] ?? 'cash');

            if ($amount <= 0) {
                echo json_encode(["success" => false, "error" => "कृपया वैध नकद राशि दर्ज करें।"]);
                exit;
            }

            $stmt = $db->prepare("UPDATE contributions SET name = ?, mobile = ?, type = 'cash', date = ?, remark = ?, amount = ?, payment_mode = ?, item_name = NULL, quantity = NULL, rate = NULL, total_value = NULL WHERE id = ?");
            $success = $stmt->execute([$name, $mobile, $date, $remark, $amount, $payment_mode, $id]);
        } else {
            $item_name = trim($data['item_name'] ?? '');
            $quantity = (float)($data['quantity'] ?? 0);
            $rate = (float)($data['rate'] ?? 0);
            $total_value = $quantity * $rate;

            if (empty($item_name) || $quantity <= 0 || $rate <= 0) {
                echo json_encode(["success" => false, "error" => "सामग्री का नाम, मात्रा और दर सही ढंग से दर्ज करें।"]);
                exit;
            }

            $stmt = $db->prepare("UPDATE contributions SET name = ?, mobile = ?, type = 'goods', date = ?, remark = ?, item_name = ?, quantity = ?, rate = ?, total_value = ?, amount = NULL, payment_mode = NULL WHERE id = ?");
            $success = $stmt->execute([$name, $mobile, $date, $remark, $item_name, $quantity, $rate, $total_value, $id]);
        }

        if ($success) {
            echo json_encode(["success" => true, "message" => "योगदान सफलता पूर्वक अपडेट किया गया।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "योगदान अपडेट करने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'update_expense':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $id = (int)($data['id'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);
        $paid_to = trim($data['paid_to'] ?? '');
        $date = trim($data['date'] ?? '');
        $description = trim($data['description'] ?? '');
        $bill_image = trim($data['bill_image'] ?? ''); // base64 string
        $keep_existing_image = (bool)($data['keep_existing_image'] ?? true);

        // Verify user session
        $user = check_auth($db, $user_mobile);
        if (!$user) {
            echo json_encode(["success" => false, "error" => "अनधिकृत एक्सेस।"]);
            exit;
        }

        // Check if edit is locked
        if (is_edit_locked($db) && !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "सिस्टम लॉक है। आप संपादन नहीं कर सकते।"]);
            exit;
        }

        if ($id <= 0 || $amount <= 0 || empty($paid_to) || empty($date)) {
            echo json_encode(["success" => false, "error" => "आईडी, राशि, भुगतान पाने वाले का नाम और तारीख आवश्यक हैं।"]);
            exit;
        }

        // Get existing bill image first
        $img_stmt = $db->prepare("SELECT bill_image FROM expenses WHERE id = ?");
        $img_stmt->execute([$id]);
        $existing_expense = $img_stmt->fetch();
        $image_path = $existing_expense ? $existing_expense['bill_image'] : null;

        if (!$keep_existing_image) {
            // Delete old image if we are clearing it or uploading a new one
            if (!empty($image_path) && file_exists($image_path)) {
                unlink($image_path);
            }
            $image_path = null;
        }

        if (!empty($bill_image) && strpos($bill_image, 'data:image') === 0) {
            // Save new base64 image
            $image_parts = explode(";base64,", $bill_image);
            if (count($image_parts) == 2) {
                $image_type_aux = explode("image/", $image_parts[0]);
                $image_type = $image_type_aux[1] ?? 'png';
                $image_base64 = base64_decode($image_parts[1]);
                
                $filename = 'bill_' . uniqid() . '.' . $image_type;
                $upload_dir = 'uploads/';
                if (!file_exists($upload_dir)) {
                    mkdir($upload_dir, 0777, true);
                }
                
                if (file_put_contents($upload_dir . $filename, $image_base64)) {
                    $image_path = $upload_dir . $filename;
                }
            }
        }

        $stmt = $db->prepare("UPDATE expenses SET amount = ?, paid_to = ?, date = ?, description = ?, bill_image = ? WHERE id = ?");
        $success = $stmt->execute([$amount, $paid_to, $date, $description, $image_path, $id]);

        if ($success) {
            echo json_encode(["success" => true, "message" => "खर्च सफलता पूर्वक अपडेट किया गया।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "खर्च अपडेट करने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'delete_entry':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $id = (int)($data['id'] ?? 0);
        $type = trim($data['type'] ?? ''); // 'contribution' or 'expense'

        // Verify user session
        $user = check_auth($db, $user_mobile);
        if (!$user) {
            echo json_encode(["success" => false, "error" => "अनधिकृत एक्सेस।"]);
            exit;
        }

        // Check if edit is locked
        if (is_edit_locked($db) && !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "सिस्टम लॉक है। आप प्रविष्टि नहीं हटा सकते।"]);
            exit;
        }

        if ($id <= 0 || empty($type)) {
            echo json_encode(["success" => false, "error" => "अमान्य अनुरोध।"]);
            exit;
        }

        if ($type === 'contribution') {
            $stmt = $db->prepare("DELETE FROM contributions WHERE id = ?");
            $success = $stmt->execute([$id]);
        } else if ($type === 'expense') {
            // Delete bill image if exists
            $img_stmt = $db->prepare("SELECT bill_image FROM expenses WHERE id = ?");
            $img_stmt->execute([$id]);
            $row = $img_stmt->fetch();
            if ($row) {
                if (!empty($row['bill_image']) && file_exists($row['bill_image'])) {
                    unlink($row['bill_image']);
                }
            }
            $stmt = $db->prepare("DELETE FROM expenses WHERE id = ?");
            $success = $stmt->execute([$id]);
        } else {
            echo json_encode(["success" => false, "error" => "अमान्य प्रकार।"]);
            exit;
        }

        if ($success) {
            echo json_encode(["success" => true, "message" => "प्रविष्टि सफलता पूर्वक हटा दी गई।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "हटाने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'toggle_member':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $member_id = (int)($data['member_id'] ?? 0);
        $status = (int)($data['status'] ?? 1); // 1 = enable, 0 = disable

        // Verify admin
        $user = check_auth($db, $user_mobile);
        if (!$user || !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "यह क्रिया करने के लिए आपके पास एडमिन अधिकार होने चाहिए।"]);
            exit;
        }

        if ($member_id <= 0) {
            echo json_encode(["success" => false, "error" => "अमान्य सदस्य।"]);
            exit;
        }

        // Prevent self disabling
        if ($member_id == $user['id']) {
            echo json_encode(["success" => false, "error" => "आप अपना खुद का एक्सेस ब्लॉक नहीं कर सकते।"]);
            exit;
        }

        $stmt = $db->prepare("UPDATE members SET status = ? WHERE id = ?");
        $success = $stmt->execute([$status, $member_id]);
        if ($success) {
            echo json_encode(["success" => true, "message" => "सदस्य का एक्सेस स्टेटस अपडेट कर दिया गया है।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "स्टेटस अपडेट करने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'toggle_edit_mode':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $edit_locked = (int)($data['edit_locked'] ?? 0); // 1 = lock, 0 = unlock

        // Verify admin
        $user = check_auth($db, $user_mobile);
        if (!$user || !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "यह क्रिया करने के लिए आपके पास एडमिन अधिकार होने चाहिए।"]);
            exit;
        }

        $stmt = $db->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'edit_locked'");
        $val_str = (string)$edit_locked;
        $success = $stmt->execute([$val_str]);
        if ($success) {
            echo json_encode(["success" => true, "message" => "सिस्टम एडिट मोड " . ($edit_locked ? "लॉक" : "अनलॉक") . " कर दिया गया है।"]);
        } else {
            $err = $db->errorInfo();
            echo json_encode(["success" => false, "error" => "सिस्टम सेटिंग बदलने में विफल: " . ($err[2] ?? '')]);
        }
        break;

    case 'add_member':
        $data = get_json_input();
        $user_mobile = trim($data['user_mobile'] ?? '');
        $name = trim($data['name'] ?? '');
        $mobile = trim($data['mobile'] ?? '');

        // Verify authentication
        $user = check_auth($db, $user_mobile);
        if (!$user) {
            echo json_encode(["success" => false, "error" => "अनधिकृत एक्सेस।"]);
            exit;
        }

        // Allow any logged-in member to add, unless system is edit locked
        if (is_edit_locked($db) && !$user['is_admin']) {
            echo json_encode(["success" => false, "error" => "संपादन मोड लॉक है। आप सदस्य नहीं जोड़ सकते।"]);
            exit;
        }

        if (empty($name) || empty($mobile)) {
            echo json_encode(["success" => false, "error" => "नाम और मोबाइल नंबर आवश्यक हैं।"]);
            exit;
        }

        // Validate mobile format
        if (!preg_match('/^[0-9]{10}$/', $mobile)) {
            echo json_encode(["success" => false, "error" => "मोबाइल नंबर 10 अंकों का होना चाहिए।"]);
            exit;
        }

        try {
            $stmt = $db->prepare("INSERT INTO members (name, mobile, status, is_admin) VALUES (?, ?, 0, 0)");
            $success = $stmt->execute([$name, $mobile]);
            if ($success) {
                echo json_encode(["success" => true, "message" => "नया सदस्य सफलता पूर्वक जोड़ा गया। पासवर्ड उनके मोबाइल के अंतिम 4 अंक होंगे।"]);
            } else {
                $err = $db->errorInfo();
                echo json_encode(["success" => false, "error" => "सदस्य जोड़ने में विफल: " . ($err[2] ?? '')]);
            }
        } catch (PDOException $e) {
            if ($e->errorInfo[1] == 1062) {
                echo json_encode(["success" => false, "error" => "यह मोबाइल नंबर पहले से पंजीकृत है।"]);
            } else {
                echo json_encode(["success" => false, "error" => "सदस्य जोड़ने में विफल: " . $e->getMessage()]);
            }
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "अमान्य क्रिया (Invalid Action)"]);
        break;
}
?>
