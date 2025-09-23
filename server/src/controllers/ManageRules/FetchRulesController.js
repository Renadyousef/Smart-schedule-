import pool from '../../../DataBase_config/DB_config.js'
//diaplay rules on page
export const fetch_rules=async(req,res)=>{

    try{
        const result=await pool.query('SELECT "rule_id","description","applies_to","timeBlock","dayConstraints" from "schedule_rules" ORDER BY "rule_id"');
         res.json(result.rows); // send rows to frontend

    }catch(err){
        console.log(`${err} at fetch controller`);
         res.status(500).json({ error: "Internal server error" });
    }
}