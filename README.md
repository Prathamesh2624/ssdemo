# Sunrise Supermarket - Deployable Project

A full-stack supermarket website for **online shopping with store pickup only**.

## Included
- Customer website
- Cart and pickup checkout
- Admin login
- Add, edit, delete products
- Upload product images
- View pickup orders
- OTP-based admin password change demo

## Store details already added
- **Name:** Sunrise Supermarket
- **Address:** Shop No 25, Kharpal, Assonora, Goa 403503
- **Phone:** 9371820223

## Default admin login
- **Username:** `admin`
- **Password:** `Sunrise@123`

## Important note about OTP
This project includes an OTP flow, but in this deployable demo the OTP is printed in the **backend console/logs**.
For real production use, connect an SMS or WhatsApp provider such as Twilio, MSG91, or similar.

---

## Local setup

### 1) Install Node.js
Use Node 20 or above.

### 2) Install dependencies
From the main project folder:

```bash
npm install
npm run install-all
```

### 3) Backend setup
Copy:

```bash
backend/.env.example -> backend/.env
```

Set values if needed.

### 4) Frontend setup
Copy:

```bash
frontend/.env.example -> frontend/.env
```

### 5) Run both
From the main folder:

```bash
npm run dev
```

Frontend:
- http://localhost:5173

Backend:
- http://localhost:4000

---

## Best way to make it live on internet

### Option A: Easy and good
- Deploy **frontend** on **Vercel** or **Netlify**
- Deploy **backend** on **Render**

### Option B: Single VPS
- Put both on a VPS using Node.js + Nginx

---

## Deploy frontend on Vercel / Netlify

### Build command
```bash
npm run build
```
Run inside `frontend`

### Publish directory
```bash
dist
```

### Environment variable
Add:
```bash
VITE_API_URL=https://your-backend-url.com
```

---

## Deploy backend on Render

### Root directory
`backend`

### Build command
```bash
npm install
```

### Start command
```bash
npm start
```

### Environment variables
Add these in Render:
```bash
PORT=4000
JWT_SECRET=your_long_random_secret
ADMIN_PHONE=9371820223
FRONTEND_URL=https://your-frontend-url.com
```

---

## Important production limitations
This version uses a JSON file for storage.
That is fine for a demo or first version, but for a real business website you should later move to:
- MongoDB Atlas
- Supabase
- PostgreSQL
- Cloudinary for image hosting
- Real OTP provider

---

## Folder structure

```text
sunrise-supermarket-project/
  frontend/
  backend/
  README.md
```

---

## What to edit first
- Change admin password after first login
- Replace sample product images and names
- Add more categories
- Connect real payment gateway only if needed later
- Connect real OTP service for password reset

