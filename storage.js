const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// =====================================================
// DATA DIRECTORY VA FAYLLARNI TAYYORLASH
// =====================================================

function ensureDataFiles() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        if (!fs.existsSync(SETTINGS_FILE)) {
            fs.writeFileSync(
                SETTINGS_FILE,
                JSON.stringify({ price: 2 }, null, 2)
            );
        }

        if (!fs.existsSync(ORDERS_FILE)) {
            fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.error("❌ DATA FILES INIT ERROR:", error.message);
    }
}

ensureDataFiles();

// =====================================================
// SETTINGS (NARX)
// =====================================================

function loadSettings() {
    try {
        const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
        const data = JSON.parse(raw);

        if (!Number.isInteger(data.price) || data.price < 0) {
            return { price: 2 };
        }

        return data;
    } catch (error) {
        console.error("⚠️ SETTINGS O'QILMADI:", error.message);
        return { price: 2 };
    }
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(
            SETTINGS_FILE,
            JSON.stringify(settings, null, 2)
        );
        return true;
    } catch (error) {
        console.error("❌ SETTINGS SAQLANMADI:", error.message);
        return false;
    }
}

// =====================================================
// ORDERS
// =====================================================

function loadOrders() {
    try {
        const raw = fs.readFileSync(ORDERS_FILE, "utf8");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("⚠️ ORDERS O'QILMADI:", error.message);
        return [];
    }
}

function saveOrders(orders) {
    try {
        fs.writeFileSync(
            ORDERS_FILE,
            JSON.stringify(orders, null, 2)
        );
        return true;
    } catch (error) {
        console.error("❌ ORDERS SAQLANMADI:", error.message);
        return false;
    }
}

function addOrder(order) {
    const orders = loadOrders();
    orders.push(order);
    saveOrders(orders);
    return order;
}

function updateOrder(orderId, patch) {
    const orders = loadOrders();
    const idx = orders.findIndex((o) => o.orderId === orderId);

    if (idx === -1) return null;

    orders[idx] = { ...orders[idx], ...patch };
    saveOrders(orders);
    return orders[idx];
}

function getOrder(orderId) {
    const orders = loadOrders();
    return orders.find((o) => o.orderId === orderId) || null;
}

module.exports = {
    loadSettings,
    saveSettings,
    loadOrders,
    saveOrders,
    addOrder,
    updateOrder,
    getOrder
};
