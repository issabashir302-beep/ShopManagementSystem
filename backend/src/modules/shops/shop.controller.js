import { sendSuccess } from '../../utils/apiResponse.js'

export function createShopController(shopService) {
  return {
    create: async (req, res) =>
      sendSuccess(res, await shopService.createShop(req.auth, req.validated), 201),
    getMe: async (req, res) => sendSuccess(res, await shopService.getCurrentShop(req.auth)),
    updateMe: async (req, res) =>
      sendSuccess(res, await shopService.updateCurrentShop(req.auth, req.validated))
  }
}
