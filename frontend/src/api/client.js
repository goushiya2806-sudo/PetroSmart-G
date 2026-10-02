const API = "http://localhost:5000/api";

export async function apiRequest(path, method = "GET", body) {
  const token =
    sessionStorage.getItem("token") ||
    localStorage.getItem("token");

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(API + path, options);

  let data = {};

  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data.message ||
      data.error ||
      "Something went wrong"
    );
  }

  return data;
}