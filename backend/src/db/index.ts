import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config()

const ConnectDb = async ()=>{
try {
const dbUri= process.env.DB_URI;
console.log('DB URI:', dbUri);

if(!dbUri) 
    { console.log("Warning: No DB_URI found in environment variables");
      console.log("Add DB_URI=mongodb://localhost:27017/meet_app to your .env file");
      return; // Don't exit, let the server run without DB for basic functionality
    }
const connectionInstance = await mongoose.connect(`${dbUri}`);    
   console.log(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
    );
} catch (error) {
    console.log('====================================');
    console.log("MONGODB connection error:",error);
    console.log('====================================');
    console.log("Server will continue without database connection");
    // Don't exit - let the server run for WebRTC functionality
}
};




export default ConnectDb;







