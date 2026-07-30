import { Router } from 'express';
import { PatientController } from '@controllers/patient.controller';
import { authenticateDoctor } from '@middleware/auth.middleware';

const router = Router();
const controller = new PatientController();

router.use(authenticateDoctor);

router.post('/', (req, res) => controller.createPatient(req, res));
router.get('/', (req, res) => controller.getPatients(req, res));
router.get('/:id', (req, res) => controller.getPatientById(req, res));

export default router;
