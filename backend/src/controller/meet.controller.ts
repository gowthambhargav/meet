import { RequestHandler } from 'express'
import { Rooms } from '../util/rooms'
import type { IOServer } from '../util/socket'
import Meeting from '../Schema/meetin'

// Optional: holder for io instance if you want to emit from HTTP
let ioRef: IOServer | null = null
export const attachIO = (io: IOServer) => {
	ioRef = io
}

export const joinMeeting: RequestHandler = async (req, res) => {
	try {
		const { roomId, userId, name } = req.body || {}
		if (!roomId || !userId) return res.status(400).json({ error: 'roomId and userId are required' })

		const participants = Rooms.join(roomId, { userId, name, joinedAt: Date.now() })

		// Update persistent meeting record if it exists
		try {
			await Meeting.findOneAndUpdate(
				{ code: roomId },
				{ 
					$addToSet: { ParticipantIds: userId },
					$inc: { peopleInCall: 1 },
					isActive: true
				},
				{ new: true }
			)
		} catch {}

		// Notify room via socket (if available)
		ioRef?.to(roomId).emit('user-joined-http', { userId, name })

		res.json({ ok: true, roomId, participants })
	} catch (e) {
		res.status(500).json({ error: 'Failed to join meeting' })
	}
}

export const leaveMeeting: RequestHandler = async (req, res) => {
	try {
		const { roomId, userId } = req.body || {}
		if (!roomId || !userId) return res.status(400).json({ error: 'roomId and userId are required' })

		const participants = Rooms.leave(roomId, userId)
		try {
			await Meeting.findOneAndUpdate(
				{ code: roomId },
				{ $inc: { peopleInCall: -1 } },
				{ new: true }
			)
		} catch {}
		ioRef?.to(roomId).emit('user-left-http', { userId })
		res.json({ ok: true, roomId, participants })
	} catch (e) {
		res.status(500).json({ error: 'Failed to leave meeting' })
	}
}

export const endMeeting: RequestHandler = async (req, res) => {
	try {
		const { roomId } = req.body || {}
		if (!roomId) return res.status(400).json({ error: 'roomId is required' })
		const participants = Rooms.end(roomId)
		let deleted = false
		try {
			const existing = await Meeting.findOne({ code: roomId })
			if (existing) {
				await Meeting.deleteOne({ _id: existing._id })
				deleted = true
			}
		} catch {}
		ioRef?.to(roomId).emit('meeting-ended')
		res.json({ ok: true, roomId, participants, deleted })
	} catch (e) {
		res.status(500).json({ error: 'Failed to end meeting' })
	}
}

export const listParticipants: RequestHandler = async (req, res) => {
	try {
		const { roomId } = req.params
		if (!roomId) return res.status(400).json({ error: 'roomId is required' })
		const participants = Rooms.participants(roomId)
		res.json({ ok: true, roomId, participants })
	} catch (e) {
		res.status(500).json({ error: 'Failed to fetch participants' })
	}
}

export const createMeeting: RequestHandler = async (req, res) => {
	try {
		const { code, hostUserId, title, description } = req.body || {}
		if (!code || !hostUserId) return res.status(400).json({ error: 'code and hostUserId are required' })
		// Basic reuse if already exists
		let existing = await Meeting.findOne({ code })
		const origin = process.env.CLIENT_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
		const shareUrl = `${origin.replace(/\/$/, '')}/call?m=${encodeURIComponent(code)}`
		if (existing) {
			return res.json({ ok: true, meeting: existing, shareUrl, reused: true })
		}
		const now = new Date()
		const doc = await Meeting.create({
			title: title || 'Instant Meeting',
			description,
			scheduledTime: now,
			durationMinutes: 60,
			hostUserId,
			code,
			shareUrl,
			isActive: true,
			peopleInCall: 1,
			ParticipantIds: [hostUserId]
		})
		res.json({ ok: true, meeting: doc, shareUrl })
	} catch (e: any) {
		res.status(500).json({ error: 'Failed to create meeting', details: e?.message })
	}
}


