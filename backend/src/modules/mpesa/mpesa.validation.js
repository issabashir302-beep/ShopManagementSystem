import { AppError } from '../../errors/AppError.js'
import { rejectUnknownFields, requireObject, stringField, uuidField } from '../../utils/validation.js'

const oneOf = (value, name, choices) => { const result=stringField(value,name,{required:true}); if(!choices.includes(result)) throw AppError.badRequest('VALIDATION_ERROR',`${name} is invalid`,{fields:[name]}); return result }
export function validateSettings(body) {
  requireObject(body); rejectUnknownFields(body,['preference','environment','shortcodeType','shortcode','storeNumber','businessName','paymentInstructions','consumerKey','consumerSecret','passkey'])
  const preference=oneOf(body.preference,'preference',['not_selected','manual','integrated','not_using'])
  const result={ preference, environment: body.environment ? oneOf(body.environment,'environment',['sandbox','production']) : 'sandbox', shortcodeType: body.shortcodeType ? oneOf(body.shortcodeType,'shortcodeType',['till','paybill']) : undefined, shortcode:stringField(body.shortcode,'shortcode',{max:20,pattern:/^\d+$/}), storeNumber:stringField(body.storeNumber,'storeNumber',{max:20,pattern:/^\d+$/}), businessName:stringField(body.businessName,'businessName',{max:120}), paymentInstructions:stringField(body.paymentInstructions,'paymentInstructions',{max:500}), consumerKey:stringField(body.consumerKey,'consumerKey',{max:300}), consumerSecret:stringField(body.consumerSecret,'consumerSecret',{max:300}), passkey:stringField(body.passkey,'passkey',{max:500}) }
  if(['manual','integrated'].includes(preference)&&(!result.shortcode||!result.shortcodeType)) throw AppError.badRequest('VALIDATION_ERROR','Shortcode and shortcode type are required',{fields:['shortcode','shortcodeType']})
  return result
}
export function validateInitiate(body){ requireObject(body); rejectUnknownFields(body,['saleId','phoneNumber','idempotencyKey']); const raw=stringField(body.phoneNumber,'phoneNumber',{required:true}).replace(/[\s()+-]/g,''); const local=raw.startsWith('0')?`254${raw.slice(1)}`:raw.startsWith('254')?raw:null; if(!local||!/^254[17]\d{8}$/.test(local)) throw AppError.badRequest('VALIDATION_ERROR','Enter a valid Kenyan M-Pesa number',{fields:['phoneNumber']}); return {saleId:uuidField(body.saleId,'saleId'),phoneNumber:local,idempotencyKey:uuidField(body.idempotencyKey,'idempotencyKey')} }
export function validateAttemptId(value){return uuidField(value,'attemptId')}
export function validateManual(body){requireObject(body);rejectUnknownFields(body,['paymentId','receiptNumber']);return{paymentId:uuidField(body.paymentId,'paymentId'),receiptNumber:stringField(body.receiptNumber,'receiptNumber',{required:true,min:6,max:30,pattern:/^[A-Za-z0-9]+$/}).toUpperCase()}}
