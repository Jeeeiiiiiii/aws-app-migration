import { useCallback, useEffect, useState } from "react";

interface Product {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}
interface Order {
  id: number;
  quantity: number;
  totalCents: number;
  customer: string;
  createdAt: string;
  productName: string;
}
interface WhoAmI {
  servingEnv: "on-prem" | "aws";
  database: string;
  writeMode: "open" | "frozen";
}

type Notice = { productId: number; kind: "ok" | "frozen" | "error"; text: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Store() {
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [w, p, o] = await Promise.all([
        fetch("/api/whoami").then((r) => r.json() as Promise<WhoAmI>),
        fetch("/api/products").then((r) => r.json() as Promise<Product[]>),
        fetch("/api/orders?limit=8").then((r) => r.json() as Promise<Order[]>),
      ]);
      setWho(w);
      setProducts(p);
      setOrders(o);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const buy = async (product: Product) => {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: product.id, quantity: 1, customer: "you" }),
    }).catch(() => null);
    if (res?.status === 201) {
      const { id } = (await res.json()) as { id: number };
      setNotice({ productId: product.id, kind: "ok", text: `Order #${id} placed.` });
    } else if (res?.status === 503) {
      setNotice({
        productId: product.id,
        kind: "frozen",
        text: "The store is moving. Try again in a few seconds.",
      });
    } else {
      setNotice({
        productId: product.id,
        kind: "error",
        text: "That didn't go through. Try again.",
      });
    }
    void refresh();
  };

  return (
    <div className="store">
      <header className="masthead">
        <div>
          <h1>Field &amp; Harbor Supply</h1>
          <p className="tagline">A demo store. Every product and order here is synthetic.</p>
        </div>
        {who && (
          <div className="served-by" data-env={who.servingEnv} aria-live="polite">
            <span className="served-label">Served by</span>
            <span className="served-env">{who.servingEnv === "aws" ? "AWS" : "On-prem"}</span>
            <span className="served-db">{who.database}</span>
          </div>
        )}
      </header>

      {offline && <p className="banner">The store can't be reached right now. Retrying…</p>}
      {who?.writeMode === "frozen" && !offline && (
        <p className="banner">
          The store is moving to a new home. You can browse, but orders are paused for a moment.
        </p>
      )}

      <main className="layout">
        <section aria-labelledby="catalog">
          <h2 id="catalog">Catalog</h2>
          <ul className="catalog">
            {products.map((p) => (
              <li key={p.id}>
                <div className="product">
                  <span className="name">{p.name}</span>
                  <span className="sku">{p.sku}</span>
                </div>
                <span className="price">{money.format(p.priceCents / 100)}</span>
                <span className="stock">{p.stock} left</span>
                <button type="button" onClick={() => buy(p)} disabled={p.stock < 1}>
                  Buy
                </button>
                {notice?.productId === p.id && (
                  <p className="notice" data-kind={notice.kind} role="status">
                    {notice.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
        <aside aria-labelledby="recent">
          <h2 id="recent">Just ordered</h2>
          <ol className="orders">
            {orders.map((o) => (
              <li key={o.id}>
                <span className="who">{o.customer}</span>
                <span className="what">
                  {o.quantity} × {o.productName}
                </span>
                <span className="id">#{o.id}</span>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}
