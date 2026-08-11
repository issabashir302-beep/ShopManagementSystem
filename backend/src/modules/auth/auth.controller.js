import { sendSuccess } from '../../utils/apiResponse.js'

export function createAuthController(authService) {
  return {
    signup: async (req, res) => sendSuccess(res, await authService.signup(req.validated), 201),
    login: async (req, res) => sendSuccess(res, await authService.login(req.validated)),
    refresh: async (req, res) => sendSuccess(res, await authService.refresh(req.validated.refreshToken)),
    logout: async (req, res) => sendSuccess(res, await authService.logout(req.auth.token)),
    session: async (req, res) => sendSuccess(res, {
      user: { id: req.auth.userId, email: req.auth.email }
    })
  }
}
