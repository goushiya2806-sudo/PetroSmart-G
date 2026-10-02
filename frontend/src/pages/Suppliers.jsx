import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getSuppliers,
  createSupplier,
} from "../api/suppliers";


function Suppliers() {

  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    gstin: "",
    pan: "",
    address: "",
    phone: "",
    email: "",
    status: "active",
  });


  async function loadSuppliers() {

    try {

      setLoading(true);
      setError("");

      const data = await getSuppliers({
        search,
        status: statusFilter,
      });

      setSuppliers(data.suppliers || []);

    } catch (err) {

      setError(
        err.message || "Unable to load suppliers."
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {
    loadSuppliers();
  }, [statusFilter]);


  function handleChange(event) {

    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

  }


  async function handleSubmit(event) {

    event.preventDefault();

    try {

      setSaving(true);
      setError("");
      setSuccess("");

      const result = await createSupplier(form);

      setSuppliers((current) => [
        result.supplier,
        ...current,
      ]);

      setForm({
        name: "",
        code: "",
        gstin: "",
        pan: "",
        address: "",
        phone: "",
        email: "",
        status: "active",
      });

      setShowForm(false);

      setSuccess("Supplier created successfully.");

    } catch (err) {

      setError(
        err.message || "Unable to create supplier."
      );

    } finally {

      setSaving(false);

    }

  }


  function handleSearch(event) {

    event.preventDefault();

    loadSuppliers();

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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest text-left"
            >
              <span className="material-symbols-outlined">
                dashboard
              </span>

              Dashboard
            </button>


            <button
              type="button"
              onClick={() => navigate("/purchases")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest text-left"
            >
              <span className="material-symbols-outlined">
                shopping_cart
              </span>

              Purchases
            </button>


            <button
              type="button"
              onClick={() => navigate("/suppliers")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-medium text-left"
            >
              <span className="material-symbols-outlined">
                group
              </span>

              Suppliers
            </button>


            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest text-left"
            >
              <span className="material-symbols-outlined">
                inventory_2
              </span>

              Stocks
            </button>


            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest text-left"
            >
              <span className="material-symbols-outlined">
                bar_chart
              </span>

              Reports
            </button>

          </nav>

        </aside>


        {/* Main */}

        <main className="flex-1 min-w-0">

          <header className="h-20 border-b border-outline-variant bg-surface flex items-center justify-between px-8">

            <div>

              <p className="text-sm text-on-surface-variant">
                Dashboard / Suppliers
              </p>

            </div>


            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center"
            >
              <span className="material-symbols-outlined">
                person
              </span>
            </button>

          </header>


          <section className="p-8">

            {/* Heading */}

            <div className="flex items-start justify-between mb-8">

              <div>

                <h2 className="text-3xl font-bold">
                  Supplier Management
                </h2>

                <p className="mt-2 text-on-surface-variant">
                  Manage fuel suppliers used for purchase invoices.
                </p>

              </div>


              <button
                type="button"
                onClick={() => {
                  setShowForm(true);
                  setError("");
                  setSuccess("");
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold"
              >

                <span className="material-symbols-outlined">
                  add
                </span>

                Add Supplier

              </button>

            </div>


            {/* Messages */}

            {error && (

              <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>

            )}


            {success && (

              <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
                {success}
              </div>

            )}


            {/* Add Supplier */}

            {showForm && (

              <section className="bg-surface rounded-2xl border border-outline-variant p-6 mb-6">

                <div className="flex items-center justify-between mb-6">

                  <div>

                    <h3 className="text-xl font-semibold">
                      Add Supplier
                    </h3>

                    <p className="text-sm text-on-surface-variant mt-1">
                      Enter supplier information.
                    </p>

                  </div>


                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="w-10 h-10 rounded-xl hover:bg-surface-container-low"
                  >

                    <span className="material-symbols-outlined">
                      close
                    </span>

                  </button>

                </div>


                <form onSubmit={handleSubmit}>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                    <div>

                      <label className="block text-sm font-medium mb-2">
                        Supplier Name *
                      </label>

                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Indian Oil Corporation"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                      />

                    </div>


                    <div>

                      <label className="block text-sm font-medium mb-2">
                        Supplier Code
                      </label>

                      <input
                        name="code"
                        value={form.code}
                        onChange={handleChange}
                        placeholder="IOC001"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                      />

                    </div>


                    <div>

                      <label className="block text-sm font-medium mb-2">
                        GSTIN
                      </label>

                      <input
                        name="gstin"
                        value={form.gstin}
                        onChange={handleChange}
                        placeholder="22AAAAA0000A1Z5"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant uppercase"
                      />

                    </div>


                    <div>

                      <label className="block text-sm font-medium mb-2">
                        PAN
                      </label>

                      <input
                        name="pan"
                        value={form.pan}
                        onChange={handleChange}
                        placeholder="AAAAA0000A"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant uppercase"
                      />

                    </div>


                    <div>

                      <label className="block text-sm font-medium mb-2">
                        Phone
                      </label>

                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="9876543210"
                        maxLength="10"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                      />

                    </div>


                    <div>

                      <label className="block text-sm font-medium mb-2">
                        Email
                      </label>

                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="supplier@example.com"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                      />

                    </div>


                    <div className="md:col-span-2">

                      <label className="block text-sm font-medium mb-2">
                        Address
                      </label>

                      <textarea
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Supplier address"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant resize-none"
                      />

                    </div>


                    <div>

                      <label className="block text-sm font-medium mb-2">
                        Status
                      </label>

                      <select
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                      >

                        <option value="active">
                          Active
                        </option>

                        <option value="inactive">
                          Inactive
                        </option>

                      </select>

                    </div>

                  </div>


                  <div className="flex justify-end gap-3 mt-6">

                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-5 py-3 rounded-xl border border-outline-variant"
                    >
                      Cancel
                    </button>


                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Supplier"}
                    </button>

                  </div>

                </form>

              </section>

            )}


            {/* Filters */}

            <section className="bg-surface-container-low rounded-2xl border border-outline-variant p-5 mb-6">

              <div className="flex flex-col md:flex-row gap-4">

                <form
                  onSubmit={handleSearch}
                  className="flex-1 flex gap-3"
                >

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search supplier..."
                    className="flex-1 px-4 py-3 rounded-xl border border-outline-variant bg-surface"
                  />

                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl border border-outline-variant"
                  >
                    Search
                  </button>

                </form>


                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="md:w-48 px-4 py-3 rounded-xl border border-outline-variant bg-surface"
                >

                  <option value="">
                    All Status
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                </select>

              </div>

            </section>


            {/* Supplier table */}

            <section className="bg-surface rounded-2xl border border-outline-variant overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-surface-container-low">

                    <tr>

                      <th className="text-left px-6 py-4">
                        Supplier
                      </th>

                      <th className="text-left px-6 py-4">
                        Code
                      </th>

                      <th className="text-left px-6 py-4">
                        GSTIN
                      </th>

                      <th className="text-left px-6 py-4">
                        Phone
                      </th>

                      <th className="text-left px-6 py-4">
                        Email
                      </th>

                      <th className="text-center px-6 py-4">
                        Status
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-outline-variant">

                    {loading ? (

                      <tr>

                        <td
                          colSpan="6"
                          className="text-center px-6 py-14"
                        >
                          Loading suppliers...
                        </td>

                      </tr>

                    ) : suppliers.length === 0 ? (

                      <tr>

                        <td
                          colSpan="6"
                          className="text-center px-6 py-14"
                        >

                          <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                            group
                          </span>

                          <p className="mt-3 font-semibold">
                            No suppliers found
                          </p>

                          <p className="text-sm text-on-surface-variant mt-1">
                            Add your first fuel supplier.
                          </p>

                        </td>

                      </tr>

                    ) : (

                      suppliers.map((supplier) => (

                        <tr
                          key={supplier.id}
                          className="hover:bg-surface-container-low"
                        >

                          <td className="px-6 py-5 font-semibold">
                            {supplier.name}
                          </td>

                          <td className="px-6 py-5">
                            {supplier.code || "-"}
                          </td>

                          <td className="px-6 py-5">
                            {supplier.gstin || "-"}
                          </td>

                          <td className="px-6 py-5">
                            {supplier.phone || "-"}
                          </td>

                          <td className="px-6 py-5">
                            {supplier.email || "-"}
                          </td>

                          <td className="px-6 py-5 text-center">

                            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-highest">
                              {supplier.status}
                            </span>

                          </td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

            </section>

          </section>

        </main>

      </div>

    </div>

  );
}


export default Suppliers;