// Replace your current deterministic pricing call with this pattern.
// Adapt the field IDs to the exact IDs in your KalaSetu HTML.

async function predictHeritagePrice() {
  const payload = {
    product_name: document.querySelector("#productName")?.value || "",
    description: document.querySelector("#craftDescription")?.value || "",
    features: document.querySelector("#craftFeatures")?.value || "",
    product_type: document.querySelector("#craftType")?.value || "",
    brand: "",
    net_quantity: Number(document.querySelector("#quantity")?.value || 1),
    height: document.querySelector("#height")?.value || "",
    length: document.querySelector("#length")?.value || "",
    width: document.querySelector("#width")?.value || ""
  };

  const response = await fetch("http://localhost:8000/api/predict-price", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Pricing API failed: ${response.status}`);
  }

  const result = await response.json();

  // Example UI:
  // document.querySelector("#predictedPrice").textContent =
  //   `₹${result.predicted_price.toLocaleString("en-IN")}`;
  // document.querySelector("#priceRange").textContent =
  //   `₹${result.lower_bound.toLocaleString("en-IN")} – ₹${result.upper_bound.toLocaleString("en-IN")}`;

  return result;
}
