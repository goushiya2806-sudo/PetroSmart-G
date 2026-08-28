// src/api/client.js

const API = "http://localhost:5000/api";

export async function apiRequest(path, method = "GET", body) {
  const token = localStorage.getItem("token");

  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : ""
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    throw new Error("API Error");
  }

  return res.json();
}