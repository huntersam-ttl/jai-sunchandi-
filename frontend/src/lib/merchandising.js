const FESTIVAL_TERMS = ["festival", "dashain", "tihar", "teej", "wedding"];

export function priorityCollection(collections = []) {
  return collections.find((collection) => FESTIVAL_TERMS.some((term) => collection.name?.toLowerCase().includes(term))) || collections[0] || null;
}

export function productContext(product) {
  const params = new URLSearchParams();
  [["product_code", product.product_code], ["product_name", product.name], ["category", product.category], ["metal", product.metal], ["purity", product.purity]].forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `/custom-order?${params.toString()}`;
}

export function matchesProductQuery(product, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return [product.name, product.name_np, product.product_code, product.category, product.collection, product.metal, product.purity]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}
