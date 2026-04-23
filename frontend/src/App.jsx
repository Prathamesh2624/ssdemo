import React, { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const categories = ['All', 'Groceries', 'Fruits', 'Dairy', 'Bakery'];

function inr(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export default function App() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [checkout, setCheckout] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('sunrise_admin_token') || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api('/api/store'), api('/api/products')])
      .then(([s, p]) => {
        setStore(s);
        setProducts(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => products.filter((p) => {
    const q = search.toLowerCase();
    const matchesText = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchesCategory = category === 'All' || p.category === category;
    return matchesText && matchesCategory;
  }), [products, search, category]);

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  function addToCart(product) {
    setCart((prev) => {
      const found = prev.find((item) => item.id === product.id);
      if (found) return prev.map((item) => item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, product.stock) } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  }

  function updateQty(id, qty) {
    if (qty <= 0) return setCart((prev) => prev.filter((item) => item.id !== id));
    setCart((prev) => prev.map((item) => item.id === id ? { ...item, qty } : item));
  }

  async function placeOrder(form) {
    const order = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ ...form, items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })) })
    });
    const fresh = await api('/api/products');
    setProducts(fresh);
    setCart([]);
    setCheckout(false);
    setMessage(`Order ${order.id} placed successfully. Please collect it from the supermarket.`);
  }

  function onLogin(newToken) {
    setToken(newToken);
    localStorage.setItem('sunrise_admin_token', newToken);
  }

  function onLogout() {
    setToken('');
    localStorage.removeItem('sunrise_admin_token');
  }

  if (loading) return <div className="center-screen">Loading Sunrise Supermarket...</div>;

  return (
    <div>
      <header className="hero">
        <div className="container nav">
          <div>
            <h1>Sunrise Supermarket</h1>
            <p>Online shopping with store pickup</p>
          </div>
          <div className="row gap-sm wrap">
            <button className="btn btn-light" onClick={() => setAdminOpen(true)}>Admin</button>
            <button className="btn btn-dark" onClick={() => setCheckout(true)}>Cart ({count})</button>
          </div>
        </div>
      </header>

      <main className="container section">
        <section className="card grid-2 hero-card">
          <div>
            <span className="badge">Pickup only supermarket</span>
            <h2>Order online and collect from the store.</h2>
            <p>Customers can shop online, place the order, and collect products from Sunrise Supermarket.</p>
            <div className="info-grid">
              <div className="info-box"><strong>Address</strong><br />{store.address}</div>
              <div className="info-box"><strong>Phone</strong><br />{store.phone}</div>
            </div>
          </div>
          <div className="side-note">
            <h3>How it works</h3>
            <ol>
              <li>Select products</li>
              <li>Place order online</li>
              <li>Collect from supermarket</li>
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="toolbar card">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" />
            <div className="row wrap gap-sm">
              {categories.map((item) => (
                <button key={item} className={`pill ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
          </div>
          <div className="product-grid">
            {filtered.map((product) => (
              <div className="card product-card" key={product.id}>
                <img src={product.image} alt={product.name} />
                <div className="row between top gap-sm">
                  <div>
                    <small>{product.category}</small>
                    <h3>{product.name}</h3>
                  </div>
                  <span className={`stock ${product.stock > 0 ? 'ok' : 'no'}`}>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</span>
                </div>
                <p>{product.description}</p>
                <div className="row between center">
                  <strong>{inr(product.price)}</strong>
                  <button className="btn btn-dark" disabled={product.stock <= 0} onClick={() => addToCart(product)}>Add</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container grid-3">
          <div><h4>Sunrise Supermarket</h4><p>Pickup orders only</p></div>
          <div><h4>Address</h4><p>{store.address}</p></div>
          <div><h4>Phone</h4><p>{store.phone}</p></div>
        </div>
      </footer>

      {message && <div className="toast">{message}</div>}
      {checkout && <CheckoutModal cart={cart} total={total} close={() => setCheckout(false)} updateQty={updateQty} placeOrder={placeOrder} address={store.address} />}
      {adminOpen && <AdminModal token={token} onLogin={onLogin} onLogout={onLogout} close={() => setAdminOpen(false)} refreshProducts={() => api('/api/products').then(setProducts)} api={api} />}
    </div>
  );
}

function CheckoutModal({ cart, total, updateQty, placeOrder, close, address }) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('Today 6:00 PM');
  const [error, setError] = useState('');
  async function submit() {
    try {
      if (!customerName || !phone || cart.length === 0) return setError('Please fill details and add products');
      await placeOrder({ customerName, phone, pickupTime });
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="modal-wrap"><div className="modal large">
      <h3>Pickup Checkout</h3>
      <div className="grid-2 gap-lg">
        <div className="column gap-md">
          <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
            <option>Today 6:00 PM</option>
            <option>Today 8:00 PM</option>
            <option>Tomorrow 10:00 AM</option>
            <option>Tomorrow 1:00 PM</option>
          </select>
          <div className="info-box"><strong>Pickup address</strong><br />{address}</div>
        </div>
        <div className="cart-box">
          <h4>Order Summary</h4>
          {cart.map((item) => (
            <div className="row between center cart-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <div className="qty">
                  <button onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                </div>
              </div>
              <span>{inr(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="row between center total"><strong>Total</strong><strong>{inr(total)}</strong></div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row end gap-sm"><button className="btn btn-light" onClick={close}>Cancel</button><button className="btn btn-dark" onClick={submit}>Place Order</button></div>
    </div></div>
  );
}

function AdminModal({ token, onLogin, onLogout, close, refreshProducts, api }) {
  const [auth, setAuth] = useState({ username: 'admin', password: 'Sunrise@123' });
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('products');
  const [form, setForm] = useState({ name: '', category: 'Groceries', price: '', stock: '', image: '', description: '', featured: false });
  const [editingId, setEditingId] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', otp: '' });
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (token) {
      api('/api/admin/dashboard', { headers: authHeader }).then(setDashboard).catch((e) => setError(e.message));
    }
  }, [token]);

  async function login() {
    try {
      const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(auth) });
      onLogin(data.token);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveProduct() {
    try {
      const method = editingId ? 'PUT' : 'POST';
      const path = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
      await api(path, { method, headers: authHeader, body: JSON.stringify({ ...form, price: Number(form.price), stock: Number(form.stock) }) });
      setForm({ name: '', category: 'Groceries', price: '', stock: '', image: '', description: '', featured: false });
      setEditingId('');
      const data = await api('/api/admin/dashboard', { headers: authHeader });
      setDashboard(data);
      refreshProducts();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeProduct(id) {
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await api('/api/admin/dashboard', { headers: authHeader });
      setDashboard(data);
      refreshProducts();
    } catch (e) {
      setError(e.message);
    }
  }

  async function uploadImage(file) {
    try {
      const body = new FormData();
      body.append('image', file);
      const data = await api('/api/admin/upload', { method: 'POST', headers: authHeader, body });
      setForm((prev) => ({ ...prev, image: data.url }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendOtp() {
    try {
      const data = await api('/api/admin/password/send-otp', { method: 'POST', headers: authHeader, body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }) });
      setError(data.message);
    } catch (e) {
      setError(e.message);
    }
  }

  async function verifyOtp() {
    try {
      const data = await api('/api/admin/password/verify-otp', { method: 'POST', headers: authHeader, body: JSON.stringify({ otp: passwordForm.otp }) });
      setError(data.message);
      setPasswordForm({ currentPassword: '', newPassword: '', otp: '' });
    } catch (e) {
      setError(e.message);
    }
  }

  if (!token) {
    return (
      <div className="modal-wrap"><div className="modal">
        <h3>Admin Login</h3>
        <input value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} placeholder="Username" />
        <input type="password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} placeholder="Password" />
        {/* <p className="muted">Default login: admin / Sunrise@123</p> */}
        {error && <p className="error">{error}</p>}
        <div className="row end gap-sm"><button className="btn btn-light" onClick={close}>Close</button><button className="btn btn-dark" onClick={login}>Login</button></div>
      </div></div>
    );
  }

  return (
    <div className="modal-wrap"><div className="modal xlarge">
      <div className="row between center wrap gap-sm"><h3>Admin Dashboard</h3><div className="row gap-sm"><button className="btn btn-light" onClick={onLogout}>Logout</button><button className="btn btn-dark" onClick={close}>Close</button></div></div>
      <div className="row gap-sm wrap tabs">
        {['products', 'orders', 'settings'].map((t) => <button key={t} className={`pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {error && <p className="info-box warning">{error}</p>}
      {tab === 'products' && dashboard && (
        <div className="grid-admin">
          <div className="card column gap-md">
            <h4>{editingId ? 'Edit Product' : 'Add Product'}</h4>
            <input placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            <input placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="row gap-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
            <button className="btn btn-dark" onClick={saveProduct}>Save Product</button>
          </div>
          <div className="card product-list-admin">
            {dashboard.products.map((product) => (
              <div className="admin-item" key={product.id}>
                <img src={product.image} alt={product.name} />
                <div>
                  <h4>{product.name}</h4>
                  <p>{product.category} • {inr(product.price)} • Stock {product.stock}</p>
                </div>
                <div className="row gap-sm wrap">
                  <button className="btn btn-light" onClick={() => { setEditingId(product.id); setForm(product); }}>Edit</button>
                  <button className="btn btn-danger" onClick={() => removeProduct(product.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'orders' && dashboard && (
        <div className="card order-table">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Pickup</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {dashboard.orders.length === 0 ? <tr><td colSpan="6">No orders yet</td></tr> : dashboard.orders.map((order) => (
                <tr key={order.id}><td>{order.id}</td><td>{order.customerName}</td><td>{order.phone}</td><td>{order.pickupTime}</td><td>{inr(order.total)}</td><td>{order.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'settings' && (
        <div className="grid-2 gap-lg">
          <div className="card">
            <h4>Admin details</h4>
            <p>Username: admin</p>
            <p>Recovery phone: 9371820223</p>
            <p className="muted">OTP demo sends code to backend logs. Connect SMS or WhatsApp API for real production use.</p>
          </div>
          <div className="card column gap-md">
            <h4>Change password with OTP</h4>
            <input type="password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
            <input type="password" placeholder="New password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
            <button className="btn btn-dark" onClick={sendOtp}>Send OTP</button>
            <input placeholder="Enter OTP" value={passwordForm.otp} onChange={(e) => setPasswordForm({ ...passwordForm, otp: e.target.value })} />
            <button className="btn btn-light" onClick={verifyOtp}>Verify OTP</button>
          </div>
        </div>
      )}
    </div></div>
  );
}
