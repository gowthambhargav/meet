import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import http from 'http'
import ConnectDb from './db'
import { initSocket } from './util/socket'
import meetRoutes from './routes/meet.route'
import { attachIO } from './controller/meet.controller'


const app = express()
const PORT = process.env.PORT || 3000
app.use(cors())
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
    
    const io = initSocket(server, { origin: '0.0.0.0' })
    attachIO(io)
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  })
  .catch((e) => console.log(e))
