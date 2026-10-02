import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getPurchases } from "../api/purchases";


function Purchases() {
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  async function loadPurchases() {
    try {
      setLoading(true);
      setError("");

      const data = await getPurchases({
        search,
        status,
        page: 1,
        limit: 20,
      });

      setPurchases(data.purchases || []);
    } catch (err) {
      setError(err.message || "Unable to load purchases");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPurchases();
  }, [status]);

  function handleSearch(event) {
    event.preventDefault();
    loadPurchases();
  }

  function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">

      <div className="flex min-h-screen">

        {/* Sidebar */}

        <aside className="w-64 shrink-0 border-r border-outline-variant bg-surface-container-low">

          <div className="px-6 py-6">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined">
                  local_gas_station
                </span>
              </div>

              <div>
                <h1 className="font-bold text-lg">
                  PetroSmart
                </h1>

                <p className="text-xs text-on-surface-variant">
                  Pump Management
                </p>
              </div>

            </div>

          </div>


          <nav className="px-3 space-y-1">

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors text-left"
            >
              <span className="material-symbols-outlined">
                dashboard
              </span>

              <span>
                Dashboard
              </span>
            </button>


            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-medium text-left"
            >
              <span className="material-symbols-outlined">
                shopping_cart
              </span>

              <span>
                Purchases
              </span>
            </button>


            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors text-left"
            >
              <span className="material-symbols-outlined">
                inventory_2
              </span>

              <span>
                Stocks
              </span>
            </button>


            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors text-left"
            >
              <span className="material-symbols-outlined">
                group
              </span>

              <span>
                Suppliers
              </span>
            </button>


            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors text-left"
            >
              <span className="material-symbols-outlined">
                bar_chart
              </span>

              <span>
                Reports
              </span>
            </button>

          </nav>

        </aside>


        {/* Main Content */}

        <main className="flex-1 min-w-0">

          {/* Header */}

          <header className="h-20 border-b border-outline-variant bg-surface flex items-center justify-between px-8">

            <div>

              <p className="text-sm text-on-surface-variant">
                Dashboard / Purchases
              </p>

            </div>


            <div className="flex items-center gap-4">

              <button
                type="button"
                className="w-10 h-10 rounded-full hover:bg-surface-container-highest flex items-center justify-center"
              >
                <span className="material-symbols-outlined">
                  notifications
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center"
              >
                <span className="material-symbols-outlined">
                  person
                </span>
              </button>

            </div>

          </header>


          {/* Page */}

          <section className="p-8">

            <div className="flex items-start justify-between gap-6 mb-8">

              <div>

                <h2 className="text-3xl font-bold tracking-tight">
                  Purchase Management
                </h2>

                <p className="mt-2 text-on-surface-variant">
                  Manage fuel purchases and supplier invoices.
                </p>

              </div>


              <button
                type="button"
                onClick={() => navigate("/purchases/new")}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold hover:opacity-90 transition"
              >
                <span className="material-symbols-outlined">
                  add
                </span>

                New Purchase
              </button>

            </div>


            {/* Filters */}

            <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-5 mb-6">

              <div className="flex flex-col lg:flex-row gap-4">

                <form
                  onSubmit={handleSearch}
                  className="flex-1 flex gap-3"
                >

                  <div className="relative flex-1">

                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      search
                    </span>

                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search invoice or supplier..."
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                  </div>


                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl border border-outline-variant hover:bg-surface-container-highest"
                  >
                    Search
                  </button>

                </form>


                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="lg:w-52 px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >

                  <option value="">
                    All Payment Status
                  </option>

                  <option value="pending">
                    Pending
                  </option>

                  <option value="partial">
                    Partial
                  </option>

                  <option value="paid">
                    Paid
                  </option>

                </select>

              </div>

            </div>


            {/* Error */}

            {error && (

              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>

            )}


            {/* Table */}

            <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-surface-container-low">

                    <tr>

                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Invoice
                      </th>

                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Date
                      </th>

                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Supplier
                      </th>

                      <th className="text-right px-6 py-4 text-sm font-semibold">
                        Items
                      </th>

                      <th className="text-right px-6 py-4 text-sm font-semibold">
                        Quantity
                      </th>

                      <th className="text-right px-6 py-4 text-sm font-semibold">
                        Total
                      </th>

                      <th className="text-center px-6 py-4 text-sm font-semibold">
                        Payment
                      </th>

                      <th className="text-center px-6 py-4 text-sm font-semibold">
                        Action
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-outline-variant">

                    {loading ? (

                      <tr>

                        <td
                          colSpan="8"
                          className="px-6 py-16 text-center text-on-surface-variant"
                        >

                          <span className="material-symbols-outlined animate-spin text-3xl">
                            progress_activity
                          </span>

                          <p className="mt-3">
                            Loading purchases...
                          </p>

                        </td>

                      </tr>

                    ) : purchases.length === 0 ? (

                      <tr>

                        <td
                          colSpan="8"
                          className="px-6 py-16 text-center"
                        >

                          <div className="flex flex-col items-center">

                            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">

                              <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                                receipt_long
                              </span>

                            </div>

                            <h3 className="mt-4 font-semibold text-lg">
                              No purchases found
                            </h3>

                            <p className="mt-1 text-sm text-on-surface-variant">
                              Start by recording your first fuel purchase.
                            </p>

                            <button
                              type="button"
                              onClick={() => navigate("/purchases/new")}
                              className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-medium"
                            >
                              Create Purchase
                            </button>

                          </div>

                        </td>

                      </tr>

                    ) : (

                      purchases.map((purchase) => (

                        <tr
                          key={purchase.id}
                          className="hover:bg-surface-container-low transition"
                        >

                          <td className="px-6 py-5 font-semibold">
                            {purchase.invoice_number}
                          </td>

                          <td className="px-6 py-5 text-sm">
                            {formatDate(purchase.invoice_date)}
                          </td>

                          <td className="px-6 py-5">
                            {purchase.supplier_name}
                          </td>

                          <td className="px-6 py-5 text-right">
                            {purchase.item_count}
                          </td>

                          <td className="px-6 py-5 text-right">
                            {Number(
                              purchase.total_quantity || 0
                            ).toLocaleString("en-IN")} L
                          </td>

                          <td className="px-6 py-5 text-right font-semibold">
                            ₹{formatMoney(purchase.total_amount)}
                          </td>

                          <td className="px-6 py-5 text-center">

                            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-highest">
                              {purchase.payment_status}
                            </span>

                          </td>

                          <td className="px-6 py-5 text-center">

                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/purchases/${purchase.id}`)
                              }
                              className="px-3 py-2 rounded-lg hover:bg-surface-container-highest"
                            >

                              <span className="material-symbols-outlined">
                                visibility
                              </span>

                            </button>

                          </td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}

export default Purchases;