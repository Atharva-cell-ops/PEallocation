import { Router } from 'express';
import { getCurrentCycle, getCycleElectives, getMyPreferences, savePreferences, getMyAllocationResult, } from '../controllers/student.controller.js';
const router = Router();
router.get('/cycle/current', getCurrentCycle);
router.get('/cycles/:cycleId/electives', getCycleElectives);
router.get('/cycles/:cycleId/preferences', getMyPreferences);
router.put('/cycles/:cycleId/preferences', savePreferences);
router.get('/cycles/:cycleId/results', getMyAllocationResult);
export default router;
