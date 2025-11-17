import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';




export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  token?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  token: { type: String },
});

userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function (): string {
  const token = jwt.sign({ id: this._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  userSchema.methods.token = token;
  this.token = token;
  return token;
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;







