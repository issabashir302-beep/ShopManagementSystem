import { sendSuccess } from '../../utils/apiResponse.js'

export function createUserController(userService) {
  return {
    getMe: async (req, res) => sendSuccess(res, await userService.getOwnProfile(req.auth)),
    updateMe: async (req, res) =>
      sendSuccess(res, await userService.updateOwnProfile(req.auth, req.validated))
  }
}
