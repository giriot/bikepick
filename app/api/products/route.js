import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readProducts, writeProducts, makeId, normalizeProduct } from "@/lib/store";
import { verifySession, LEGACY_ADMIN_COOKIE } from "@/lib/auth";

const isAdmin = () => legacyVerifyAdminSession(cookies().get(LEGACY_ADMIN_COOKIE)?.value);

// GET /api/products  -> public, returns the full catalog
export async function GET() {
  const products = await readProducts();
  return NextResponse.json({ ok: true, products });
}

// POST /api/products  -> admin only, create a product
export async function POST(request) {
  if (!isAdmin()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const products = await readProducts();
  const product = normalizeProduct(body, makeId());
  products.unshift(product);
  await writeProducts(products);
  return NextResponse.json({ ok: true, product });
}
