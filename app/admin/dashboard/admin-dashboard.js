"use client";

import { useEffect, useMemo, useState } from "react";
import BikeArt from "@/components/BikeArt";
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, LogoutIcon, GridIcon } from "@/components/Icons";

const TYPES = ["Commuter", "Sport", "Cruiser", "Adventure", "Off-road", "Scooter", "Electric"];
const inr = (n) => (n ? "₹" + Number(n).toLocaleString("en-IN") : "—");

const emptyForm = {
  name: "", brand: "", type: "Commuter", price: "", onRoadPrice: "", engineCC: "",
  power: "", torque: "", mileage: "", seats: "2", abs: false, safety: "",
  image: "", featured: true, launchYear: String(new Date().getFullYear()), description: "",
};

export default function AdminDashboard({ username }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [open, setOpen] = useState(false); // form panel
  const [editing, setEditing] = useState(null); // product being edited, else null
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (msg, kind = "good") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      notify("Failed to load products", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = products.length;
    const featured = products.filter((p) => p.featured).length;
    const brands = new Set(products.map((p) => p.brand)).size;
    const avg = total ? Math.round(products.reduce((s, p) => s + p.price, 0) / total) : 0;
    return { total, featured, brands, avg };
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.slice();
    const needle = q.trim().toLowerCase();
    if (needle)
      list = list.filter((p) => [p.name, p.brand, p.type].join(" ").toLowerCase().includes(needle));
    if (type !== "All") list = list.filter((p) => p.type === type);
    return list;
  }, [products, q, type]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({ ...emptyForm, ...p, price: p.price, onRoadPrice: p.onRoadPrice, engineCC: p.engineCC, seats: p.seats, launchYear: p.launchYear });
    setOpen(true);
  }

  function set(prop) {
    return (e) => {
      const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [prop]: v }));
    };
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return notify("Please enter a bike name", "err");
    setSaving(true);
    try {
      const isEdit = Boolean(editing);
      const url = isEdit ? `/api/products/${editing.id}` : "/api/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        await load();
        setOpen(false);
        notify(isEdit ? "Product updated" : "Product added");
      } else {
        notify(data.error || "Save failed", "err");
      }
    } catch {
      notify("Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.brand} ${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      await load();
      notify("Product deleted");
    } else notify(data.error || "Delete failed", "err");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="dot">B</span> bikepick<span style={{ color: "#e30917" }}>.</span>in
        </div>
        <div className="menu-label">Manage</div>
        <a className="side-item active" href="/admin/dashboard">
          <GridIcon /> Product Catalog
        </a>
        <a className="side-item" href="/">
          <span aria-hidden>↗</span> View Site
        </a>
        <div className="menu-label">Account</div>
        <a className="side-item" style={{ cursor: "pointer" }} onClick={logout}>
          <LogoutIcon /> Log out
        </a>
        <span className="spacer" />
        <div className="admin-tag">Signed in as <b style={{ color: "#dcdcdc" }}>{username}</b></div>
      </aside>

      <main className="main">
        <div className="main-head">
          <div>
            <h1>Product Catalog</h1>
            <p>Add, edit and publish bikes &amp; scooters for bikepick.in</p>
          </div>
          <span className="spacer" />
          <a className="btn btn-ghost" href="/">Visit public page</a>
          <button className="btn btn-primary" onClick={openAdd}>
            <PlusIcon /> Add product
          </button>
        </div>

        <div className="stats">
          <div className="stat"><div className="label">Total bikes</div><div className="value">{stats.total}</div></div>
          <div className="stat"><div className="label">Featured</div><div className="value red">{stats.featured}</div></div>
          <div className="stat"><div className="label">Brands</div><div className="value">{stats.brands}</div></div>
          <div className="stat"><div className="label">Avg price</div><div className="value green">{inr(stats.avg)}</div></div>
        </div>

        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" />
          </label>
          <select className="select-pill" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All types</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <span style={{ marginLeft: "auto", color: "#7a7a7a", fontSize: 13.5 }}>
            {filtered.length} show{filtered.length === 1 ? "" : "n"} of {products.length}
          </span>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="empty" style={{ padding: 40 }}>Loading catalog…</div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}>
              <b>No products found.</b>
              <br />
              {products.length === 0 ? "Click “Add product” to create your first bike." : "Try a different search or filter."}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bike</th>
                  <th>Type</th>
                  <th>Ex-showroom</th>
                  <th>On-road</th>
                  <th>Engine</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="p-row">
                        <span className="p-thumb">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 7 }} />
                          ) : (
                            <BikeArt type={p.type} />
                          )}
                        </span>
                        <span className="p-name">
                          <span className="brand">{p.brand}</span>
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td><span className="p-type">{p.type}</span></td>
                    <td>{inr(p.price)}</td>
                    <td>{inr(p.onRoadPrice)}</td>
                    <td>{p.engineCC ? `${p.engineCC} cc` : "Electric"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span className={p.featured ? "badge good" : "badge"}>{p.featured ? "● Featured" : "Standard"}</span>
                        {p.abs ? <span className="badge">ABS</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(p)}><EditIcon /></button>
                        <button className="icon-btn danger" title="Delete" onClick={() => remove(p)}><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {open && (
        <div className="overlay" onClick={() => !saving && setOpen(false)}>
          <form className="panel" onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? `Edit ${editing.brand} ${editing.name}` : "Add a new bike"}</h2>
            <div className="form-grid">
              <div className="field">
                <label>Name *</label>
                <input value={form.name} onChange={set("name")} placeholder="e.g. Classic 350" />
              </div>
              <div className="field">
                <label>Brand *</label>
                <input value={form.brand} onChange={set("brand")} placeholder="e.g. Royal Enfield" />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={set("type")}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Image URL (optional)</label>
                <input value={form.image} onChange={set("image")} placeholder="https://… .jpg" />
              </div>
              <div className="field">
                <label>Ex-showroom price (₹)</label>
                <input type="number" value={form.price} onChange={set("price")} />
              </div>
              <div className="field">
                <label>On-road price (₹)</label>
                <input type="number" value={form.onRoadPrice} onChange={set("onRoadPrice")} />
              </div>
              <div className="field">
                <label>Engine (CC)</label>
                <input type="number" value={form.engineCC} onChange={set("engineCC")} placeholder="0 for electric" />
              </div>
              <div className="field">
                <label>Power</label>
                <input value={form.power} onChange={set("power")} placeholder="e.g. 20.2 bhp / 11 kW" />
              </div>
              <div className="field">
                <label>Torque</label>
                <input value={form.torque} onChange={set("torque")} placeholder="e.g. 27 Nm" />
              </div>
              <div className="field">
                <label>Mileage / Range</label>
                <input value={form.mileage} onChange={set("mileage")} placeholder="e.g. 35 kmpl / 170 km range" />
              </div>
              <div className="field">
                <label>Seats</label>
                <input type="number" value={form.seats} onChange={set("seats")} />
              </div>
              <div className="field">
                <label>Safety / Key feature</label>
                <input value={form.safety} onChange={set("safety")} placeholder="e.g. Dual Channel ABS" />
              </div>
              <div className="field">
                <label>Launch year</label>
                <input type="number" value={form.launchYear} onChange={set("launchYear")} />
              </div>
              <div className="field full">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Description</label>
                  <textarea rows={3} value={form.description} onChange={set("description")} placeholder="A short description shown on the public card…" />
                </div>
              </div>
              <div className="field full">
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <label className="check-row">
                    <input type="checkbox" checked={form.abs} onChange={set("abs")} /> ABS / disc brakes
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={form.featured} onChange={set("featured")} /> Feature on homepage
                  </label>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
