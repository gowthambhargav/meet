import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config()

const ConnectDb = async ()=>{
try {
const dbUri= process.env.DB_URI;
console.log(dbUri);

if(!dbUri) 
    { console.log("Cant ge the dburi");
     process.exit(1);
     
    }
const connectionInstance = await mongoose.connect(`${dbUri}`);    
   console.log(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
    );
} catch (error) {
    console.log('====================================');
    console.log("MONGODB",error);
    console.log('====================================');
    process.exit(1);
}
};




export default ConnectDb;







