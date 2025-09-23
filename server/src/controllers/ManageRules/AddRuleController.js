import pool from '../../../DataBase_config/DB_config.js'
//diaplay rules on page
export const add_rule=async(req,res)=>{
const { description, applies_to, timeBlock, dayConstraints } = req.body;
try{
    const result=await pool.query(`INSERT INTO "schedule_rules" ("description", "applies_to", "timeBlock", "dayConstraints")
       VALUES ($1, $2, $3, $4)
       RETURNING *`,   // return the newly added row
      [description, applies_to, timeBlock, dayConstraints]);

        res.status(201).json(result.rows[0]);


}catch(err){
    console.log(`${err.message} happens at add rule controller`)
    res.status(500).json({error: "Internal server error" })
}

}