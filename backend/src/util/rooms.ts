export type Participant = {
  userId: string
  name?: string
  joinedAt: number
}

class RoomManager {
  private rooms = new Map<string, Map<string, Participant>>()

  join(roomId: string, user: Participant) {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map())
    const room = this.rooms.get(roomId)!
    room.set(user.userId, user)
    return Array.from(room.values())
  }

  leave(roomId: string, userId: string) {
    const room = this.rooms.get(roomId)
    if (!room) return []
    room.delete(userId)
    if (room.size === 0) this.rooms.delete(roomId)
    return Array.from(room.values())
  }

  participants(roomId: string) {
    const room = this.rooms.get(roomId)
    return room ? Array.from(room.values()) : []
  }

  end(roomId: string) {
    const parts = this.participants(roomId)
    this.rooms.delete(roomId)
    return parts
  }
}

export const Rooms = new RoomManager()
