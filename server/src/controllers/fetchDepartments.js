import pool from '../../DataBase_config/DB_config.js'


export const fetchDepartments=async(req,res)=>{

    try{
       const result=await pool.query('Select "DepartmentID","Name" from "Departments" order by "DepartmentID"');
       res.json(result.rows);//returns lower case from the db columns by defualt
    }catch(err){
        console.error(err.message)
          res.status(500).send("Server error");
    }
}