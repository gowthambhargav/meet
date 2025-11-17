import jwt from "jsonwebtoken";





export const GetDetailsFromToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };  
    return decoded;
  } catch (error) {
    console.error("Invalid token:", error);
    return null;
  }
}