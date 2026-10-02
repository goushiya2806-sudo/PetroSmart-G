import pool from "../db.js";

export async function getSuppliers(req, res) {
  try {
    const pumpId = req.user.pump_id;

    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();

    const values = [pumpId];

    let where = `
      WHERE s.pump_id = $1
        AND s.deleted_at IS NULL
    `;

    if (search) {
      values.push(`%${search}%`);

      where += `
        AND (
          s.name ILIKE $${values.length}
          OR COALESCE(s.code, '') ILIKE $${values.length}
          OR COALESCE(s.phone, '') ILIKE $${values.length}
        )
      `;
    }

    if (status) {
      values.push(status);

      where += `
        AND s.status = $${values.length}
      `;
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.code,
        s.gstin,
        s.pan,
        s.address,
        s.phone,
        s.email,
        s.status,
        s.created_at,
        s.updated_at
      FROM suppliers s
      ${where}
      ORDER BY s.name ASC
      `,
      values
    );

    res.json({
      suppliers: result.rows,
    });

  } catch (error) {
    console.error("Get suppliers error:", error);

    res.status(500).json({
      message: "Unable to load suppliers.",
    });
  }
}


export async function createSupplier(req, res) {
  try {
    const pumpId = req.user.pump_id;

    const {
      name,
      code,
      gstin,
      pan,
      address,
      phone,
      email,
      status,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Supplier name is required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO suppliers (
        pump_id,
        name,
        code,
        gstin,
        pan,
        address,
        phone,
        email,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING
        id,
        name,
        code,
        gstin,
        pan,
        address,
        phone,
        email,
        status,
        created_at
      `,
      [
        pumpId,
        name.trim(),
        code?.trim() || null,
        gstin?.trim() || null,
        pan?.trim() || null,
        address?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        status || "active",
      ]
    );

    res.status(201).json({
      message: "Supplier created successfully.",
      supplier: result.rows[0],
    });

  } catch (error) {
    console.error("Create supplier error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "A supplier with this code already exists for this pump.",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        message: "One or more supplier details are invalid.",
      });
    }

    res.status(500).json({
      message: "Unable to create supplier.",
    });
  }
}