import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readProducts, writeProducts, normalizeProduct } from "@/lib/store";
import { verifySession, LEGACY_ADMIN_COOKIE } from "@/lib/auth";

const isAdmin = () => legacyVerifyAdminSession(cookies().get(LEGACY_ADMIN_COOKIE)?.value);

// PUT /api/products/:id -> admin only, update a product
export async function PUT(request, { params }) {
  if (!isAdmin()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const products = await readProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }
  const updated = normalizeProduct({ ...products[idx], ...body }, id, products[idx].createdAt);
  products[idx] = updated;
  await writeProducts(products);
  return NextResponse.json({ ok: true, product: updated });
}

// DELETE /api/products/:id -> admin only
export async function DELETE(_request, { params }) {
  if (!isAdmin()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;
  const products = await readProducts();
  const next = products.filter((p) => p.id !== id);
  if (next.length === products.length) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }
  await writeProducts(next);
  return NextResponse.json({ ok: true });
}
