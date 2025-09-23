import pool from '../../../DataBase_config/DB_config.js'
//delete controller
export const delete_rule=async(req,res)=>{

     const { id } = req.params;
       try {
    const result = await pool.query(
      `DELETE FROM schedule_rules WHERE rule_id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({ message: "Rule deleted successfully" });
  } catch (err) {
    console.error(err.message, "happens at delete rule controller");
    res.status(500).json({ error: "Internal server error" });
  }


}