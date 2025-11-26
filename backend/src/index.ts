import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import http from 'http'
import dotenv from 'dotenv'
import ConnectDb from './db'
import { initSocket } from './util/socket'
import meetRoutes from './routes/meet.route'
import { attachIO } from './controller/meet.controller'

// Load environment variables
dotenv.config()


const app = express()
const PORT = process.env.PORT || 3000

// Configure CORS to allow frontend connections
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
  res.send('Hello, World!');
});






// Routes
import userRoutes from './routes/user.route';


























// Use Routes
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/meet', meetRoutes)






































ConnectDb()
  .then(() => {
    const server = http.createServer(app);
    
    // Get client origin from environment
    const clientOrigin = process.env.CLIENT_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
    const io = initSocket(server, { origin: clientOrigin })
    attachIO(io)
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
      console.log(`Client origin: ${clientOrigin}`)
    })
  })
  .catch((e) => console.log(e))
