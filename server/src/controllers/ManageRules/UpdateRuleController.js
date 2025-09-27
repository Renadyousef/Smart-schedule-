import pool from '../../../DataBase_config/DB_config.js'
//update rules by id
export const update_rule=async(req,res)=>{

 try {
    const { id } = req.params;
    const { description, applies_to, timeBlock, dayConstraints } = req.body;

    const result = await pool.query(
      `UPDATE schedule_rules 
       SET "description" = $1, "applies_to" = $2, "timeBlock" = $3, "dayConstraints" = $4 
       WHERE "rule_id" = $5 RETURNING *`,
      [description, applies_to, timeBlock, dayConstraints, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Rule not found" });
    }

    res.json(result.rows[0]); // send updated rule back
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });


  }
}




