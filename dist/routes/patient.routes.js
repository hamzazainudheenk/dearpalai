"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_controller_1 = require("../controllers/patient.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const controller = new patient_controller_1.PatientController();
router.use(auth_middleware_1.authenticateDoctor);
router.post('/', (req, res) => controller.createPatient(req, res));
router.get('/', (req, res) => controller.getPatients(req, res));
router.get('/:id', (req, res) => controller.getPatientById(req, res));
exports.default = router;
//# sourceMappingURL=patient.routes.js.map