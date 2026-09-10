import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createMpesaController } from './mpesa.controller.js'
import { validateAttemptId,validateInitiate,validateManual,validateSettings } from './mpesa.validation.js'
const validate=fn=>(req,_res,next)=>{try{req.validated=fn(req.body);next()}catch(error){next(error)}}
export function createMpesaRouter({authService,mpesaService}){const router=Router(),controller=createMpesaController(mpesaService),auth=requireAuth(authService);router.get('/payment-methods',auth,asyncHandler(controller.availability));router.get('/mpesa/settings',auth,asyncHandler(controller.settings));router.put('/mpesa/settings',auth,validate(validateSettings),asyncHandler(controller.save));router.post('/mpesa/verify',auth,asyncHandler(controller.verify));router.post('/mpesa/stk-push',auth,validate(validateInitiate),asyncHandler(controller.initiate));router.get('/mpesa/attempts/:attemptId',auth,(req,_res,next)=>{try{req.validatedAttemptId=validateAttemptId(req.params.attemptId);next()}catch(error){next(error)}},asyncHandler(controller.attempt));router.post('/mpesa/manual-confirmation',auth,validate(validateManual),asyncHandler(controller.manual));return router}
export function createMpesaWebhookRouter(mpesaService){const router=Router(),controller=createMpesaController(mpesaService);router.post('/api/v1/webhooks/mpesa/daraja',asyncHandler(controller.callback));return router}
