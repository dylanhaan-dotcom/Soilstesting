# Materials Testing Lab — Setup Guide

## 1. Enable GitHub Pages

1. Push this repo to GitHub (it's already configured)
2. Go to **Settings → Pages**
3. Set Source to **Deploy from a branch → main → / (root)**
4. Your site will be live at `https://YOUR_USERNAME.github.io/Soilstesting/`
5. Optional: go to your domain registrar and add a CNAME record pointing `soils.yourdomain.com` to `YOUR_USERNAME.github.io`

---

## 2. Set Up Supabase (free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — choose a region near you, set a strong database password
3. Wait ~2 minutes for the project to provision
4. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key
5. Paste both values into **`js/supabase-config.js`**:
   ```js
   const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
   const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
   ```

---

## 3. Run the Database Schema

1. In Supabase, go to **SQL Editor → New Query**
2. Paste the entire contents of **`supabase/schema.sql`**
3. Click **Run** — this creates all tables and security policies

---

## 4. Create the Reports Storage Bucket

1. In Supabase, go to **Storage → New bucket**
2. Name it exactly: `reports`
3. Set it to **Private** (not public)
4. Go to **Storage → reports → Policies** and add:
   - **INSERT**: `(select role from profiles where id = auth.uid()) = 'admin'`
   - **SELECT**: Allow authenticated users to read (RLS on test_results handles scoping)

---

## 5. Create Your First Admin Account

1. Open your site at `https://…/portal/`
2. Click **"Request access"** and sign up with the admin email
3. In Supabase, go to **Table Editor → profiles**
4. Find your user row and change `role` from `client` to `admin`
5. Now sign in to **`/admin/`** — you have full admin access

---

## 6. Set Up the Contact Form (optional — Supabase handles it natively)

The contact form submits directly to the `quote_requests` table via Supabase.
No Formspree account needed. If you want email notifications when a quote comes in,
set up a **Supabase Database Webhook** → **Edge Function** → email via Resend or SendGrid.

---

## Site Structure

```
/                  → Public marketing site (index.html)
/portal/           → Customer portal (login, view samples & results)
/admin/            → Lab admin panel (manage projects, samples, results, quotes)
/css/style.css     → Shared stylesheet
/js/
  supabase-config.js  ← PUT YOUR CREDENTIALS HERE
  main.js
  contact-form.js
/supabase/
  schema.sql       → Run this once in Supabase SQL Editor
```

---

## Customization Checklist

- [ ] Update lab name (search & replace "Materials Testing Laboratory" and "MTL")
- [ ] Update phone, email, and address in `index.html` contact section
- [ ] Add real lab hours
- [ ] Update or remove services you don't offer
- [ ] Add your state DOT approval number if applicable
- [ ] Add your AASHTO accreditation number to the about section
- [ ] Replace placeholder `YOUR_FORM_ID` in the form action if using Formspree as fallback
