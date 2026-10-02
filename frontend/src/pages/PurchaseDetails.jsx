import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getPurchase } from "../api/purchases";


function PurchaseDetails() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {

    async function loadPurchase() {

      try {

        setLoading(true);

        const data = await getPurchase(id);

        setPurchase(data.purchase || data);

      } catch (err) {

        setError(
          err.message || "Unable to load purchase"
        );

      } finally {

        setLoading(false);

      }

    }

    loadPurchase();

  }, [id]);


  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center">

        <div className="text-center">

          <span className="material-symbols-outlined animate-spin text-4xl">
            progress_activity
          </span>

          <p className="mt-3">
            Loading purchase...
          </p>

        </div>

      </div>
    );

  }


  if (error) {

    return (
      <div className="min-h-screen p-8">

        <button
          type="button"
          onClick={() => navigate("/purchases")}
          className="mb-6 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">
            arrow_back
          </span>

          Back to Purchases
        </button>

        <div className="p-5 rounded-xl bg-red-50 text-red-700">
          {error}
        </div>

      </div>
    );

  }


  if (!purchase) {
    return null;
  }


  const items = purchase.items || purchase.purchase_items || [];


  function money(value) {

    return Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  }


  return (

    <div className="min-h-screen bg-surface text-on-surface">

      <main className="max-w-7xl mx-auto px-6 py-8">

        <button
          type="button"
          onClick={() => navigate("/purchases")}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6"
        >

          <span className="material-symbols-outlined">
            arrow_back
          </span>

          Back to Purchases

        </button>


        <div className="flex justify-between items-start mb-8">

          <div>

            <p className="text-sm text-on-surface-variant">
              Purchases / Purchase Details
            </p>

            <h1 className="text-3xl font-bold mt-1">
              {purchase.invoice_number}
            </h1>

          </div>


          <span className="px-4 py-2 rounded-full bg-surface-container-highest text-sm font-semibold">
            {purchase.payment_status || "-"}
          </span>

        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          <section className="bg-surface rounded-2xl border border-outline-variant p-6">

            <h2 className="text-xl font-semibold mb-5">
              Invoice Information
            </h2>

            <div className="space-y-4 text-sm">

              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Invoice Number
                </span>

                <span className="font-medium">
                  {purchase.invoice_number || "-"}
                </span>
              </div>


              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Invoice Date
                </span>

                <span>
                  {purchase.invoice_date
                    ? new Date(
                        purchase.invoice_date
                      ).toLocaleString("en-IN")
                    : "-"
                  }
                </span>
              </div>


              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Supplier
                </span>

                <span>
                  {purchase.supplier_name || "-"}
                </span>
              </div>

            </div>

          </section>


          <section className="bg-surface rounded-2xl border border-outline-variant p-6">

            <h2 className="text-xl font-semibold mb-5">
              Delivery Information
            </h2>

            <div className="space-y-4 text-sm">

              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Shipment Document
                </span>

                <span>
                  {purchase.shipment_doc_no || "-"}
                </span>
              </div>


              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Delivery Number
                </span>

                <span>
                  {purchase.delivery_no || "-"}
                </span>
              </div>


              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Vehicle Number
                </span>

                <span>
                  {purchase.vehicle_number || "-"}
                </span>
              </div>


              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Transporter
                </span>

                <span>
                  {purchase.transporter_name || "-"}
                </span>
              </div>

            </div>

          </section>

        </div>


        <section className="bg-surface rounded-2xl border border-outline-variant overflow-hidden mb-6">

          <div className="p-6 border-b border-outline-variant">

            <h2 className="text-xl font-semibold">
              Fuel Items
            </h2>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-surface-container-low">

                <tr>

                  <th className="text-left px-6 py-4">
                    Fuel
                  </th>

                  <th className="text-left px-6 py-4">
                    Tank
                  </th>

                  <th className="text-right px-6 py-4">
                    Quantity
                  </th>

                  <th className="text-right px-6 py-4">
                    Rate
                  </th>

                  <th className="text-right px-6 py-4">
                    Tax
                  </th>

                  <th className="text-right px-6 py-4">
                    Total
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-outline-variant">

                {items.map((item, index) => (

                  <tr key={item.id || index}>

                    <td className="px-6 py-4">
                      {item.fuel_name || item.fuel_type_name || "-"}
                    </td>

                    <td className="px-6 py-4">
                      {item.tank_name || "-"}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {Number(item.quantity || 0).toLocaleString("en-IN")} L
                    </td>

                    <td className="px-6 py-4 text-right">
                      ₹{money(item.purchase_rate)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      ₹{money(item.tax_amount)}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold">
                      ₹{money(item.total_amount)}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </section>


        <div className="flex justify-end">

          <div className="w-full md:w-96 bg-surface rounded-2xl border border-outline-variant p-6">

            <h2 className="text-xl font-semibold mb-5">
              Purchase Summary
            </h2>

            <div className="space-y-3">

              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  ₹{money(purchase.subtotal)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Tax</span>
                <span>
                  ₹{money(purchase.tax_amount)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Other Charges</span>
                <span>
                  ₹{money(purchase.other_charges)}
                </span>
              </div>

              <div className="border-t border-outline-variant pt-4 flex justify-between text-xl font-bold">

                <span>
                  Total
                </span>

                <span>
                  ₹{money(purchase.total_amount)}
                </span>

              </div>

            </div>

          </div>

        </div>

      </main>

    </div>

  );
}


export default PurchaseDetails;