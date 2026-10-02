/**
 * Synthetic traffic: simulated shoppers that browse and place orders through the
 * front door. They record nothing; the front door is where traffic is observed.
 */
const frontDoor = process.env.FRONT_DOOR_URL ?? "http://localhost:8080";
const shoppers = Number(process.env.SHOPPERS ?? 6);
/** Average pause between a shopper's requests. */
const pauseMs = Number(process.env.PAUSE_MS ?? 600);
const names = ["ana", "ben", "chen", "dara", "eli", "femi", "gus", "hana", "ivo", "jun"];

let productIds: number[] = [];

async function shop(shopper: string): Promise<never> {
  for (;;) {
    try {
      if (productIds.length === 0 || Math.random() < 0.3) {
        const res = await fetch(`${frontDoor}/api/products`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) productIds = ((await res.json()) as { id: number }[]).map((p) => p.id);
      } else {
        const productId = productIds[Math.floor(Math.random() * productIds.length)];
        await fetch(`${frontDoor}/api/orders`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId,
            quantity: 1 + Math.floor(Math.random() * 2),
            customer: shopper,
          }),
          signal: AbortSignal.timeout(5000),
        }).then((r) => r.body?.cancel());
      }
    } catch {
      // The front door records failures; a shopper just tries again later.
    }
    await new Promise((r) => setTimeout(r, pauseMs * (0.5 + Math.random())));
  }
}

console.log(`${shoppers} synthetic shoppers browsing ${frontDoor}`);
for (let i = 0; i < shoppers; i++) void shop(`${names[i % names.length]}-sim`);
