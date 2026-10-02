import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getPurchaseOptions,
  createPurchase,
} from "../api/purchases";


function NewPurchase() {

  const navigate = useNavigate();

  const [options, setOptions] = useState({
    suppliers: [],
    fuels: [],
    tanks: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [shipmentDocNo, setShipmentDocNo] = useState("");
  const [deliveryNo, setDeliveryNo] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");

  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState([
    {
      fuel_type_id: "",
      tank_id: "",
      quantity: "",
      purchase_rate: "",
      tax_rate: "",
      tax_amount: "",
      other_charges: "",
      batch_number: "",
    },
  ]);


  useEffect(() => {

    async function loadOptions() {

      try {

        setLoading(true);

        const data = await getPurchaseOptions();

        setOptions({
          suppliers: data.suppliers || [],
          fuels: data.fuels || [],
          tanks: data.tanks || [],
        });

      } catch (err) {

        setError(err.message || "Unable to load purchase options");

      } finally {

        setLoading(false);

      }

    }

    loadOptions();

  }, []);


  function updateItem(index, field, value) {

    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );

  }


  function addItem() {

    setItems((current) => [
      ...current,
      {
        fuel_type_id: "",
        tank_id: "",
        quantity: "",
        purchase_rate: "",
        tax_rate: "",
        tax_amount: "",
        other_charges: "",
        batch_number: "",
      },
    ]);

  }


  function removeItem(index) {

    if (items.length === 1) return;

    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );

  }


  function getItemSubtotal(item) {

    return (
      Number(item.quantity || 0) *
      Number(item.purchase_rate || 0)
    );

  }


  function getItemTax(item) {

    const subtotal = getItemSubtotal(item);

    if (item.tax_amount) {
      return Number(item.tax_amount);
    }

    return (
      subtotal *
      Number(item.tax_rate || 0) /
      100
    );

  }


  const subtotal = items.reduce(
    (sum, item) => sum + getItemSubtotal(item),
    0
  );


  const taxAmount = items.reduce(
    (sum, item) => sum + getItemTax(item),
    0
  );


  const otherCharges = items.reduce(
    (sum, item) => sum + Number(item.other_charges || 0),
    0
  );


  const totalAmount =
    subtotal +
    taxAmount +
    otherCharges;


  async function handleSubmit(event) {

    event.preventDefault();

    try {

      setSaving(true);
      setError("");

      if (!supplierId) {
        throw new Error("Please select a supplier.");
      }

      if (!invoiceNumber.trim()) {
        throw new Error("Please enter invoice number.");
      }

      if (!invoiceDate) {
        throw new Error("Please select invoice date.");
      }

      if (!items.length) {
        throw new Error("Add at least one fuel item.");
      }

      for (const item of items) {

        if (!item.fuel_type_id) {
          throw new Error("Select fuel for every item.");
        }

        if (!item.tank_id) {
          throw new Error("Select tank for every item.");
        }

        if (Number(item.quantity) <= 0) {
          throw new Error("Quantity must be greater than zero.");
        }

        if (Number(item.purchase_rate) < 0) {
          throw new Error("Purchase rate cannot be negative.");
        }

      }


      const payload = {

        supplier_id: supplierId,

        invoice_number: invoiceNumber.trim(),

        invoice_date: invoiceDate,

        shipment_doc_no: shipmentDocNo.trim(),

        delivery_no: deliveryNo.trim(),

        vehicle_number: vehicleNumber.trim(),

        transporter_name: transporterName.trim(),

        subtotal,

        tax_amount: taxAmount,

        other_charges: otherCharges,

        rounding_amount: 0,

        total_amount: totalAmount,

        payment_status: paymentStatus,

        payment_method: paymentMethod,

        notes: notes.trim(),

        items: items.map((item) => ({

          fuel_type_id: item.fuel_type_id,

          tank_id: item.tank_id,

          quantity: Number(item.quantity),

          uom: "litre",

          purchase_rate: Number(item.purchase_rate),

          tax_rate: Number(item.tax_rate || 0),

          tax_amount: getItemTax(item),

          other_charges: Number(item.other_charges || 0),

          subtotal: getItemSubtotal(item),

          total_amount:
            getItemSubtotal(item) +
            getItemTax(item) +
            Number(item.other_charges || 0),

          batch_number:
            item.batch_number.trim() || null,

        })),

      };


      const result = await createPurchase(payload);

      navigate(
        `/purchases/${result.purchase_id}`,
        { replace: true }
      );

    } catch (err) {

      setError(
        err.message || "Unable to create purchase."
      );

    } finally {

      setSaving(false);

    }

  }


  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl">
            progress_activity
          </span>

          <p className="mt-3">
            Loading purchase options...
          </p>
        </div>
      </div>
    );

  }


  return (

    <div className="min-h-screen bg-surface text-on-surface">

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}

        <div className="flex items-center gap-4 mb-8">

          <button
            type="button"
            onClick={() => navigate("/purchases")}
            className="w-10 h-10 rounded-xl hover:bg-surface-container-highest flex items-center justify-center"
          >
            <span className="material-symbols-outlined">
              arrow_back
            </span>
          </button>

          <div>

            <p className="text-sm text-on-surface-variant">
              Purchases / New Purchase
            </p>

            <h1 className="text-3xl font-bold">
              Create Purchase
            </h1>

            <p className="mt-1 text-on-surface-variant">
              Record a supplier invoice and add fuel to inventory.
            </p>

          </div>

        </div>


        {error && (

          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>

        )}


        <form onSubmit={handleSubmit}>

          {/* Invoice */}

          <section className="bg-surface rounded-2xl border border-outline-variant p-6 mb-6">

            <h2 className="text-xl font-semibold mb-6">
              Invoice Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              <div>

                <label className="block text-sm font-medium mb-2">
                  Supplier *
                </label>

                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface"
                  required
                >

                  <option value="">
                    Select supplier
                  </option>

                  {options.suppliers.map((supplier) => (

                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>

                  ))}

                </select>

              </div>


              <div>

                <label className="block text-sm font-medium mb-2">
                  Invoice Number *
                </label>

                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                  placeholder="INV-0001"
                  required
                />

              </div>


              <div>

                <label className="block text-sm font-medium mb-2">
                  Invoice Date *
                </label>

                <input
                  type="datetime-local"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant"
                  required
                />

              </div>

            </div>

          </section>


          {/* Delivery */}

          <section className="bg-surface rounded-2xl border border-outline-variant p-6 mb-6">

            <h2 className="text-xl font-semibold mb-6">
              Delivery Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

              <input
                value={shipmentDocNo}
                onChange={(e) => setShipmentDocNo(e.target.value)}
                placeholder="Shipment document no."
                className="px-4 py-3 rounded-xl border border-outline-variant"
              />

              <input
                value={deliveryNo}
                onChange={(e) => setDeliveryNo(e.target.value)}
                placeholder="Delivery no."
                className="px-4 py-3 rounded-xl border border-outline-variant"
              />

              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Vehicle / truck no."
                className="px-4 py-3 rounded-xl border border-outline-variant"
              />

              <input
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="Transporter"
                className="px-4 py-3 rounded-xl border border-outline-variant"
              />

            </div>

          </section>


          {/* Items */}

          <section className="bg-surface rounded-2xl border border-outline-variant p-6 mb-6">

            <div className="flex items-center justify-between mb-6">

              <div>

                <h2 className="text-xl font-semibold">
                  Fuel Items
                </h2>

                <p className="text-sm text-on-surface-variant mt-1">
                  Add every fuel product included in this invoice.
                </p>

              </div>


              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined">
                  add
                </span>

                Add Item
              </button>

            </div>


            <div className="space-y-4">

              {items.map((item, index) => {

                const availableTanks =
                  options.tanks.filter(
                    (tank) =>
                      !item.fuel_type_id ||
                      tank.fuel_type_id === item.fuel_type_id
                  );

                return (

                  <div
                    key={index}
                    className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant"
                  >

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                      <select
                        value={item.fuel_type_id}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "fuel_type_id",
                            e.target.value
                          )
                        }
                        className="px-4 py-3 rounded-xl border border-outline-variant bg-surface"
                      >

                        <option value="">
                          Select fuel
                        </option>

                        {options.fuels.map((fuel) => (

                          <option
                            key={fuel.id}
                            value={fuel.id}
                          >
                            {fuel.fuel_name}
                          </option>

                        ))}

                      </select>


                      <select
                        value={item.tank_id}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "tank_id",
                            e.target.value
                          )
                        }
                        className="px-4 py-3 rounded-xl border border-outline-variant bg-surface"
                      >

                        <option value="">
                          Select tank
                        </option>

                        {availableTanks.map((tank) => (

                          <option
                            key={tank.id}
                            value={tank.id}
                          >
                            {tank.tank_name}
                          </option>

                        ))}

                      </select>


                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "quantity",
                            e.target.value
                          )
                        }
                        placeholder="Quantity (L)"
                        className="px-4 py-3 rounded-xl border border-outline-variant"
                      />


                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={item.purchase_rate}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "purchase_rate",
                            e.target.value
                          )
                        }
                        placeholder="Purchase rate"
                        className="px-4 py-3 rounded-xl border border-outline-variant"
                      />

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.tax_rate}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "tax_rate",
                            e.target.value
                          )
                        }
                        placeholder="Tax %"
                        className="px-4 py-3 rounded-xl border border-outline-variant"
                      />


                      <input
                        value={item.batch_number}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "batch_number",
                            e.target.value
                          )
                        }
                        placeholder="Batch number"
                        className="px-4 py-3 rounded-xl border border-outline-variant"
                      />


                      <div className="px-4 py-3 rounded-xl bg-surface border border-outline-variant">

                        <p className="text-xs text-on-surface-variant">
                          Item total
                        </p>

                        <p className="font-semibold">
                          ₹
                          {(
                            getItemSubtotal(item) +
                            getItemTax(item) +
                            Number(item.other_charges || 0)
                          ).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </p>

                      </div>


                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="px-4 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove Item
                      </button>

                    </div>

                  </div>

                );

              })}

            </div>

          </section>


          {/* Payment */}

          <section className="bg-surface rounded-2xl border border-outline-variant p-6 mb-6">

            <h2 className="text-xl font-semibold mb-6">
              Payment & Notes
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="px-4 py-3 rounded-xl border border-outline-variant"
              >

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


              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="px-4 py-3 rounded-xl border border-outline-variant"
              >

                <option value="">
                  Payment method
                </option>

                <option value="cash">
                  Cash
                </option>

                <option value="bank_transfer">
                  Bank Transfer
                </option>

                <option value="upi">
                  UPI
                </option>

                <option value="cheque">
                  Cheque
                </option>

              </select>


              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                className="px-4 py-3 rounded-xl border border-outline-variant"
              />

            </div>

          </section>


          {/* Summary */}

          <section className="flex justify-end">

            <div className="w-full md:w-96 bg-surface rounded-2xl border border-outline-variant p-6">

              <h2 className="text-xl font-semibold mb-5">
                Purchase Summary
              </h2>

              <div className="space-y-3 text-sm">

                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    ₹{subtotal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>
                    ₹{taxAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Other Charges</span>
                  <span>
                    ₹{otherCharges.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="border-t border-outline-variant pt-4 flex justify-between text-lg font-bold">

                  <span>
                    Total
                  </span>

                  <span>
                    ₹{totalAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>

                </div>

              </div>


              <div className="flex gap-3 mt-6">

                <button
                  type="button"
                  onClick={() => navigate("/purchases")}
                  className="flex-1 px-4 py-3 rounded-xl border border-outline-variant"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-on-primary font-semibold disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Purchase"}
                </button>

              </div>

            </div>

          </section>

        </form>

      </div>

    </div>

  );
}


export default NewPurchase;