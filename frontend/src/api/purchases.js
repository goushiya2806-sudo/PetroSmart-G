import { apiRequest } from "./client";

export function getPurchaseOptions() {
  return apiRequest("/purchases/options");
}

export function getPurchases(params = {}) {
  const query = new URLSearchParams();

  if (params.search) {
    query.set("search", params.search);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  if (params.supplierId) {
    query.set("supplier_id", params.supplierId);
  }

  if (params.from) {
    query.set("from", params.from);
  }

  if (params.to) {
    query.set("to", params.to);
  }

  if (params.page) {
    query.set("page", params.page);
  }

  if (params.limit) {
    query.set("limit", params.limit);
  }

  const queryString = query.toString();

  return apiRequest(
    `/purchases${queryString ? `?${queryString}` : ""}`
  );
}

export function getPurchase(id) {
  return apiRequest(`/purchases/${id}`);
}

export function createPurchase(data) {
  return apiRequest("/purchases", "POST", data);
}