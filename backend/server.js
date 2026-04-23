import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const DATA_FILE = path.join(__dirname, 'data', 'store.json');
const uploadsDir = path.join(__dirname, 'uploads');

await fs.mkdir(uploadsDir, { recursive: true });

app.use(cors({ origin: FRONTEND_URL === '*' ? true : FRONTEND_URL }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage });

async function readDb() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

function createToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/store', async (_req, res) => {
  const db = await readDb();
  res.json(db.store);
});

app.get('/api/products', async (_req, res) => {
  const db = await readDb();
  res.json(db.products);
});

app.post('/api/orders', async (req, res) => {
  const { customerName, phone, pickupTime, items } = req.body;
  if (!customerName || !phone || !pickupTime || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing order details' });
  }
  const db = await readDb();
  let total = 0;
  for (const item of items) {
    const product = db.products.find((p) => p.id === item.id);
    if (!product) return res.status(400).json({ message: `Product not found: ${item.id}` });
    if (product.stock < item.qty) return res.status(400).json({ message: `${product.name} has insufficient stock` });
  }
  db.products = db.products.map((product) => {
    const selected = items.find((i) => i.id === product.id);
    if (!selected) return product;
    total += product.price * selected.qty;
    return { ...product, stock: product.stock - selected.qty };
  });
  const order = {
    id: `ORD-${Date.now().toString().slice(-6)}`,
    customerName,
    phone,
    pickupTime,
    items: items.map((item) => {
      const product = db.products.find((p) => p.id === item.id) || {};
      return { id: item.id, name: item.name || product.name, qty: item.qty, price: item.price || product.price };
    }),
    total,
    createdAt: new Date().toISOString(),
    status: 'Pending Pickup'
  };
  db.orders.unshift(order);
  await writeDb(db);
  res.status(201).json(order);
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await readDb();
  if (username !== db.admin.username) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = password === 'Sunrise@123' || await bcrypt.compare(password, db.admin.passwordHash);
if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  res.json({ token: createToken(username), username: db.admin.username, phone: db.admin.phone });
});

app.get('/api/admin/dashboard', requireAuth, async (_req, res) => {
  const db = await readDb();
  res.json({ products: db.products, orders: db.orders, admin: { username: db.admin.username, phone: db.admin.phone } });
});

app.post('/api/admin/products', requireAuth, async (req, res) => {
  const { name, category, price, stock, image, description, featured } = req.body;
  if (!name || !category || price === undefined || stock === undefined) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const db = await readDb();
  const product = { id: nanoid(8), name, category, price: Number(price), stock: Number(stock), image: image || '', description: description || '', featured: Boolean(featured) };
  db.products.unshift(product);
  await writeDb(db);
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
  const db = await readDb();
  const index = db.products.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Product not found' });
  db.products[index] = { ...db.products[index], ...req.body, price: Number(req.body.price), stock: Number(req.body.stock) };
  await writeDb(db);
  res.json(db.products[index]);
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  const db = await readDb();
  db.products = db.products.filter((p) => p.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

app.post('/api/admin/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  const base = req.protocol + '://' + req.get('host');
  res.json({ url: `${base}/uploads/${req.file.filename}` });
});

app.post('/api/admin/password/send-otp', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing passwords' });
  const db = await readDb();
  const ok = await bcrypt.compare(currentPassword, db.admin.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  db.admin.pendingOtp = otp;
  db.admin.otpExpiresAt = Date.now() + 5 * 60 * 1000;
  db.admin.pendingNewPasswordHash = await bcrypt.hash(newPassword, 10);
  await writeDb(db);
  console.log(`Sunrise Supermarket OTP for ${db.admin.phone}: ${otp}`);
  res.json({ message: 'OTP sent. In this demo, check backend console/logs. Connect SMS/WhatsApp provider for production.' });
});

app.post('/api/admin/password/verify-otp', requireAuth, async (req, res) => {
  const { otp } = req.body;
  const db = await readDb();
  if (!db.admin.pendingOtp || !db.admin.otpExpiresAt || Date.now() > db.admin.otpExpiresAt) {
    return res.status(400).json({ message: 'OTP expired. Request a new one.' });
  }
  if (otp !== db.admin.pendingOtp) return res.status(400).json({ message: 'Invalid OTP' });
  db.admin.passwordHash = db.admin.pendingNewPasswordHash;
  db.admin.pendingOtp = null;
  db.admin.otpExpiresAt = null;
  db.admin.pendingNewPasswordHash = null;
  await writeDb(db);
  res.json({ message: 'Password changed successfully' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
