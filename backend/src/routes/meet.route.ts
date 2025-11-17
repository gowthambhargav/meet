import { Router } from 'express'
import { endMeeting, joinMeeting, leaveMeeting, listParticipants, createMeeting } from '../controller/meet.controller'

const router = Router()

router.post('/join', joinMeeting)
router.post('/leave', leaveMeeting)
router.post('/end', endMeeting)
router.post('/create', createMeeting)
router.get('/:roomId', listParticipants)

export default router
