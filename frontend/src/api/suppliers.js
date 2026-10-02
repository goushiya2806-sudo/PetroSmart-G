import { apiRequest } from "./client";

export function getSuppliers(params = {}) {
  const query = new URLSearchParams();

  if (params.search) {
    query.set("search", params.search);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  const queryString = query.toString();

  return apiRequest(
    `/suppliers${queryString ? `?${queryString}` : ""}`
  );
}

export function createSupplier(data) {
  return apiRequest("/suppliers", "POST", data);
}