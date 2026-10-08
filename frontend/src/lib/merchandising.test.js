import { matchesProductQuery, priorityCollection, productContext } from "./merchandising";

describe("merchandising helpers", () => {
  test("prioritises a festival collection while preserving admin order otherwise", () => {
    const collections = [{ name: "Daily Wear" }, { name: "Dashain-Tihar" }, { name: "Bridal" }];
    expect(priorityCollection(collections).name).toBe("Dashain-Tihar");
    expect(priorityCollection([{ name: "Daily Wear" }]).name).toBe("Daily Wear");
  });

  test("search matches product names, codes, and attributes", () => {
    const product = { name: "Tilhari Set", product_code: "JS-104", metal: "gold", purity: "22K" };
    expect(matchesProductQuery(product, "JS-104")).toBe(true);
    expect(matchesProductQuery(product, "silver")).toBe(false);
  });

  test("creates a product-aware custom order link", () => {
    const query = new URL(productContext({ product_code: "JS-104", name: "Tilhari Set", category: "Necklace", metal: "gold", purity: "22K" }), "https://example.test").searchParams;
    expect(query.get("product_code")).toBe("JS-104");
    expect(query.get("purity")).toBe("22K");
  });
});
