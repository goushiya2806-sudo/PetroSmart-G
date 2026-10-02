import pool from "../db.js";

export async function getPurchaseOptions(req, res) {
  try {
    const pumpId = req.user.pump_id;

    const suppliersResult = await pool.query(
      `
      SELECT
        id,
        name,
        code,
        gstin,
        pan,
        address,
        phone,
        email,
        status
      FROM suppliers
      WHERE pump_id = $1
        AND deleted_at IS NULL
        AND status = 'active'
      ORDER BY name
      `,
      [pumpId]
    );

    const fuelsResult = await pool.query(
      `
      SELECT
        id,
        fuel_name,
        short_code,
        unit,
        current_price,
        current_stock
      FROM fuel_types
      WHERE pump_id = $1
        AND is_active = TRUE
        AND deleted_at IS NULL
      ORDER BY display_order
      `,
      [pumpId]
    );

    const tanksResult = await pool.query(
      `
      SELECT
        id,
        fuel_type_id,
        tank_name,
        tank_number,
        capacity_litres,
        current_stock
      FROM tanks
      WHERE pump_id = $1
        AND is_active = TRUE
        AND deleted_at IS NULL
      ORDER BY tank_number
      `,
      [pumpId]
    );

    res.json({
      suppliers: suppliersResult.rows,
      fuels: fuelsResult.rows,
      tanks: tanksResult.rows,
    });
  } catch (error) {
    console.error("Purchase options error:", error);

    res.status(500).json({
      message: "Failed to load purchase options",
    });
  }
}


export async function getPurchases(req, res) {
  try {
    const pumpId = req.user.pump_id;

    const {
      search = "",
      status = "",
      supplier_id = "",
      from = "",
      to = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );

    const offset = (pageNumber - 1) * limitNumber;

    const values = [pumpId];

    let where = `
      WHERE p.pump_id = $1
        AND p.deleted_at IS NULL
    `;

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      where += `
        AND (
          p.invoice_number ILIKE $${values.length}
          OR s.name ILIKE $${values.length}
        )
      `;
    }

    if (status) {
      values.push(status);

      where += `
        AND p.payment_status = $${values.length}
      `;
    }

    if (supplier_id) {
      values.push(supplier_id);

      where += `
        AND p.supplier_id = $${values.length}
      `;
    }

    if (from) {
      values.push(from);

      where += `
        AND p.invoice_date >= $${values.length}
      `;
    }

    if (to) {
      values.push(to);

      where += `
        AND p.invoice_date < ($${values.length}::date + INTERVAL '1 day')
      `;
    }

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM purchases p
      JOIN suppliers s
        ON s.id = p.supplier_id
      ${where}
      `,
      values
    );

    const total = countResult.rows[0].total;

    values.push(limitNumber);
    values.push(offset);

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.invoice_number,
        p.invoice_date,
        p.subtotal,
        p.tax_amount,
        p.other_charges,
        p.rounding_amount,
        p.total_amount,
        p.payment_status,
        p.payment_method,
        p.status,
        p.created_at,

        s.id AS supplier_id,
        s.name AS supplier_name,

        COALESCE(
          SUM(pi.quantity),
          0
        ) AS total_quantity,

        COUNT(pi.id)::INTEGER AS item_count

      FROM purchases p

      JOIN suppliers s
        ON s.id = p.supplier_id

      LEFT JOIN purchase_items pi
        ON pi.purchase_id = p.id

      ${where}

      GROUP BY
        p.id,
        s.id,
        s.name

      ORDER BY p.invoice_date DESC

      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    res.json({
      purchases: result.rows,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get purchases error:", error);

    res.status(500).json({
      message: "Failed to load purchases",
    });
  }
}


export async function getPurchase(req, res) {
  try {
    const pumpId = req.user.pump_id;
    const purchaseId = req.params.id;

    const purchaseResult = await pool.query(
      `
      SELECT
        p.*,

        s.name AS supplier_name,
        s.code AS supplier_code,
        s.gstin AS supplier_gstin,
        s.pan AS supplier_pan,
        s.address AS supplier_address,
        s.phone AS supplier_phone,
        s.email AS supplier_email

      FROM purchases p

      JOIN suppliers s
        ON s.id = p.supplier_id

      WHERE p.id = $1
        AND p.pump_id = $2
        AND p.deleted_at IS NULL
      `,
      [purchaseId, pumpId]
    );

    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({
        message: "Purchase not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        pi.*,

        ft.fuel_name,
        ft.short_code,

        t.tank_name,
        t.tank_number

      FROM purchase_items pi

      JOIN fuel_types ft
        ON ft.id = pi.fuel_type_id

      JOIN tanks t
        ON t.id = pi.tank_id

      WHERE pi.purchase_id = $1

      ORDER BY pi.created_at ASC
      `,
      [purchaseId]
    );

    res.json({
      purchase: purchaseResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error("Get purchase error:", error);

    res.status(500).json({
      message: "Failed to load purchase",
    });
  }
}


export async function createPurchase(req, res) {
  try {
    const pumpId = req.user.pump_id;
    const recordedBy = req.user.id;

    const {
      supplier_id,
      invoice_number,
      invoice_date,
      received_at,
      header = {},
      items = [],
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({
        message: "Supplier is required",
      });
    }

    if (!invoice_number?.trim()) {
      return res.status(400).json({
        message: "Invoice number is required",
      });
    }

    if (!invoice_date) {
      return res.status(400).json({
        message: "Invoice date is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "At least one purchase item is required",
      });
    }

    const supplierCheck = await pool.query(
      `
      SELECT id
      FROM suppliers
      WHERE id = $1
        AND pump_id = $2
        AND deleted_at IS NULL
        AND status = 'active'
      `,
      [supplier_id, pumpId]
    );

    if (supplierCheck.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid supplier",
      });
    }

    const cleanItems = items.map((item) => ({
      fuel_type_id: item.fuel_type_id,
      tank_id: item.tank_id,
      quantity: Number(item.quantity),
      uom: "litre",
      purchase_rate: Number(item.purchase_rate),
      tax_rate: Number(item.tax_rate || 0),
      tax_amount: Number(item.tax_amount || 0),
      other_charges: Number(item.other_charges || 0),
      subtotal: Number(item.subtotal || 0),
      total_amount: Number(item.total_amount || 0),
      batch_number: item.batch_number || null,
      density: item.density
        ? Number(item.density)
        : null,
      temperature: item.temperature
        ? Number(item.temperature)
        : null,
      hsn_code: item.hsn_code || null,
    }));

    for (const item of cleanItems) {
      if (!item.fuel_type_id) {
        return res.status(400).json({
          message: "Every item must have a fuel type",
        });
      }

      if (!item.tank_id) {
        return res.status(400).json({
          message: "Every item must have a tank",
        });
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than zero",
        });
      }

      if (
        !Number.isFinite(item.purchase_rate) ||
        item.purchase_rate <= 0
      ) {
        return res.status(400).json({
          message: "Purchase rate must be greater than zero",
        });
      }
    }

    const result = await pool.query(
      `
      SELECT record_purchase(
        $1::UUID,
        $2::UUID,
        $3::TEXT,
        $4::TIMESTAMPTZ,
        $5::JSONB,
        $6::JSONB,
        $7::UUID,
        $8::TIMESTAMPTZ
      ) AS purchase_id
      `,
      [
        pumpId,
        supplier_id,
        invoice_number.trim(),
        invoice_date,
        JSON.stringify({
          shipment_doc_no:
            header.shipment_doc_no || null,

          delivery_no:
            header.delivery_no || null,

          vehicle_number:
            header.vehicle_number || null,

          transporter_name:
            header.transporter_name || null,

          subtotal:
            Number(header.subtotal || 0),

          tax_amount:
            Number(header.tax_amount || 0),

          other_charges:
            Number(header.other_charges || 0),

          rounding_amount:
            Number(header.rounding_amount || 0),

          total_amount:
            Number(header.total_amount || 0),

          payment_status:
            header.payment_status || "pending",

          payment_method:
            header.payment_method || null,

          notes:
            header.notes || null,
        }),
        JSON.stringify(cleanItems),
        recordedBy,
        received_at || invoice_date,
      ]
    );

    res.status(201).json({
      message: "Purchase created successfully",
      purchase_id: result.rows[0].purchase_id,
    });
  } catch (error) {
    console.error("Create purchase error:", error);

    res.status(400).json({
      message:
        error?.detail ||
        error?.message ||
        "Failed to create purchase",
    });
  }
}