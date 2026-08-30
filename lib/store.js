import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * The product store is a single JSON file (update storage).
 * Server-side read/write so changes persist across sessions and devices.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "products.json");

async function ensure() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readProducts() {
  try {
    const raw = await readFile(FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function writeProducts(products) {
  await ensure();
  const data = JSON.stringify(products, null, 2);
  await writeFile(FILE, data, "utf8");
  return products;
}

export function makeId() {
  return String(Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
}

/** Sanitize + coerce a payload into a well-formed product. */
export function normalizeProduct(raw, id, createdAt) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id,
    name: String(raw.name || "").trim(),
    brand: String(raw.brand || "").trim(),
    type: String(raw.type || "Commuter").trim(),
    price: num(raw.price),
    onRoadPrice: num(raw.onRoadPrice),
    engineCC: num(raw.engineCC),
    power: String(raw.power || "").trim(),
    torque: String(raw.torque || "").trim(),
    mileage: String(raw.mileage || "").trim(),
    seats: num(raw.seats),
    abs: Boolean(raw.abs),
    safety: String(raw.safety || "").trim(),
    image: String(raw.image || "").trim(),
    featured: Boolean(raw.featured),
    launchYear: num(raw.launchYear),
    description: String(raw.description || "").trim(),
    createdAt: createdAt || Date.now(),
  };
}
