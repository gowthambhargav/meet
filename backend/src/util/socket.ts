import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'

type InitOptions = {
  origin?: string
}

export const initSocket = (server: HttpServer, opts?: InitOptions) => {
  const io = new Server(server, {
    cors: {
      origin: opts?.origin || ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Basic WebRTC signaling over Socket.IO
  io.on('connection', (socket) => {
    // Client requests to join a room
    socket.on('join-room', ({ roomId, userId, name }: { roomId: string; userId?: string; name?: string }) => {
      if (!roomId) return
      socket.join(roomId)
      socket.to(roomId).emit('user-joined', { userId, name, socketId: socket.id })
    })

    // Relay SDP/ICE messages
    socket.on(
      'signal',
      ({ roomId, to, data }: { roomId?: string; to?: string; data: unknown }) => {
        if (to) {
          io.to(to).emit('signal', { from: socket.id, data })
        } else if (roomId) {
          socket.to(roomId).emit('signal', { from: socket.id, data })
        }
      },
    )

    // Leave room explicitly
    socket.on('leave-room', ({ roomId, userId }: { roomId: string; userId?: string }) => {
      socket.leave(roomId)
      socket.to(roomId).emit('user-left', { userId, socketId: socket.id })
    })

    socket.on('disconnect', () => {
      // Optional: broadcast to rooms if you track membership
    })
  })

  console.log('Socket.IO initialized')
  return io
}

export type IOServer = Server